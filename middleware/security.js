const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const fs = require('fs');
const path = require('path');

// Initialize DOMPurify
const window = new JSDOM('').window;
const DOMPurifyInstance = DOMPurify(window);

// CSRF Token generation
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

// CSRF Middleware
function csrfProtection(req, res, next) {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // Skip CSRF for authentication routes (login, register, etc.)
    const authRoutes = ['/auth/login', '/auth/register', '/auth/register-restaurant', '/auth/register-driver'];
    if (authRoutes.includes(req.path)) {
        return next();
    }

    const token = req.body._csrf || req.headers['x-csrf-token'] || req.headers['csrf-token'];

    if (!token) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF requerido'
        });
    }

    if (!req.session.csrfToken || token !== req.session.csrfToken) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido'
        });
    }

    next();
}

// Middleware to set CSRF token
function setCSRFToken(req, res, next) {
    // Always generate a fresh token for each request to prevent stale tokens
    req.session.csrfToken = generateCSRFToken();
    res.locals.csrfToken = req.session.csrfToken;
    next();
}

// Input sanitization middleware
function sanitizeInput(req, res, next) {
    // Sanitize all string inputs
    function sanitizeObject(obj) {
        for (let key in obj) {
            if (typeof obj[key] === 'string') {
                obj[key] = DOMPurifyInstance.sanitize(obj[key], {
                    ALLOWED_TAGS: [], // Remove all HTML tags
                    ALLOWED_ATTR: []
                }).trim();
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitizeObject(obj[key]);
            }
        }
    }

    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);

    next();
}

// Granular rate limiting
const createRateLimit = (windowMs, max, message = 'Demasiadas solicitudes') => {
    return rateLimit({
        windowMs,
        max,
        message: { success: false, message },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => {
            // Skip rate limiting for admin users
            return req.session.user && req.session.user.tipo_usuario === 'admin';
        }
    });
};

const authRateLimit = createRateLimit(15 * 60 * 1000, process.env.NODE_ENV === 'production' ? 5 : 20, 'Demasiados intentos de autenticación');
const apiRateLimit = createRateLimit(15 * 60 * 1000, process.env.NODE_ENV === 'production' ? 100 : 500, 'Demasiadas solicitudes a la API');
const fileUploadRateLimit = createRateLimit(60 * 60 * 1000, process.env.NODE_ENV === 'production' ? 10 : 50, 'Demasiados archivos subidos');

// Slow down for brute force protection
const authSlowDown = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 3,
    delayMs: 500,
    skip: (req) => {
        return req.session.user && req.session.user.tipo_usuario === 'admin';
    }
});

// File upload validation
function validateFileUpload(req, res, next) {
    if (!req.file && !req.files) {
        return next();
    }

    const files = req.files || [req.file];
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain'
    ];
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (let file of files) {
        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
            return res.status(400).json({
                success: false,
                message: 'Tipo de archivo no permitido'
            });
        }

        // Check file size
        if (file.size > maxSize) {
            return res.status(400).json({
                success: false,
                message: 'Archivo demasiado grande (máximo 5MB)'
            });
        }

        // Check for malicious content (basic check)
        if (file.mimetype.startsWith('image/')) {
            // For images, check if it's actually an image
            const buffer = file.buffer || fs.readFileSync(file.path);
            if (buffer.length < 4) {
                return res.status(400).json({
                    success: false,
                    message: 'Archivo de imagen inválido'
                });
            }

            // Check magic bytes
            const magicBytes = buffer.slice(0, 4);
            const imageSignatures = {
                jpeg: [0xFF, 0xD8, 0xFF],
                png: [0x89, 0x50, 0x4E, 0x47],
                gif: [0x47, 0x49, 0x46],
                webp: [0x52, 0x49, 0x46, 0x46]
            };

            let isValidImage = false;
            for (let [format, signature] of Object.entries(imageSignatures)) {
                if (magicBytes.slice(0, signature.length).every((byte, i) => byte === signature[i])) {
                    isValidImage = true;
                    break;
                }
            }

            if (!isValidImage) {
                return res.status(400).json({
                    success: false,
                    message: 'Archivo de imagen corrupto o malicioso'
                });
            }
        }
    }

    next();
}

// Data encryption utilities
class DataEncryption {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.tagLength = 16;
        this.ivLength = 16;
    }

    // Generate encryption key from password
    generateKey(password, salt) {
        return crypto.scryptSync(password, salt, this.keyLength);
    }

    // Encrypt sensitive data
    encrypt(text, password) {
        const salt = crypto.randomBytes(32);
        const key = this.generateKey(password, salt);
        const iv = crypto.randomBytes(this.ivLength);

        const cipher = crypto.createCipher(this.algorithm, key);
        cipher.setAAD(Buffer.from('a-la-mesa-encryption'));

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            salt: salt.toString('hex'),
            iv: iv.toString('hex'),
            tag: authTag.toString('hex')
        };
    }

    // Decrypt sensitive data
    decrypt(encryptedData, password) {
        const { encrypted, salt, iv, tag } = encryptedData;
        const key = this.generateKey(password, salt);
        const decipher = crypto.createDecipher(this.algorithm, key);

        decipher.setAAD(Buffer.from('a-la-mesa-encryption'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}

// Security logging
class SecurityLogger {
    constructor() {
        this.logFile = path.join(__dirname, '../logs/security.log');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        // Solo crear directorio de logs en desarrollo, no en producción (Vercel)
        if (process.env.NODE_ENV !== 'production') {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }

    log(level, message, details = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            details,
            ip: details.ip || 'unknown',
            userId: details.userId || 'anonymous',
            userAgent: details.userAgent || 'unknown'
        };

        const logLine = JSON.stringify(logEntry) + '\n';

        try {
            fs.appendFileSync(this.logFile, logLine);
        } catch (error) {
            console.error('Error writing to security log:', error);
        }

        // Also log to console for immediate visibility
        console.log(`[${level.toUpperCase()}] ${message}`, details);
    }

    logFailedLogin(email, ip, userAgent) {
        this.log('warning', 'Failed login attempt', { email, ip, userAgent, action: 'login_failed' });
    }

    logSuccessfulLogin(userId, ip, userAgent) {
        this.log('info', 'Successful login', { userId, ip, userAgent, action: 'login_success' });
    }

    logSuspiciousActivity(userId, action, details) {
        this.log('warning', `Suspicious activity: ${action}`, { userId, ...details, action: 'suspicious_activity' });
    }

    logSecurityEvent(event, details) {
        this.log('info', `Security event: ${event}`, { ...details, action: 'security_event' });
    }
}

// Enhanced permission validation
function requireOwnership(resourceType, resourceIdParam = 'id') {
    return async (req, res, next) => {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'No autorizado' });
        }

        const userId = req.session.user.id;
        const userType = req.session.user.tipo_usuario;
        const resourceId = req.params[resourceIdParam];

        try {
            let isOwner = false;

            switch (resourceType) {
                case 'restaurant':
                    if (userType === 'restaurante') {
                        const [restaurants] = await req.app.locals.db.execute(
                            'SELECT id FROM restaurantes WHERE id = ? AND usuario_id = ?',
                            [resourceId, userId]
                        );
                        isOwner = restaurants.length > 0;
                    }
                    break;

                case 'order':
                    const [orders] = await req.app.locals.db.execute(
                        'SELECT id FROM pedidos WHERE id = ? AND (cliente_id = ? OR EXISTS(SELECT 1 FROM restaurantes WHERE id = pedidos.restaurante_id AND usuario_id = ?))',
                        [resourceId, userId, userId]
                    );
                    isOwner = orders.length > 0;
                    break;

                case 'product':
                    if (userType === 'restaurante') {
                        const [products] = await req.app.locals.db.execute(
                            'SELECT p.id FROM productos p JOIN restaurantes r ON p.restaurante_id = r.id WHERE p.id = ? AND r.usuario_id = ?',
                            [resourceId, userId]
                        );
                        isOwner = products.length > 0;
                    }
                    break;

                default:
                    return res.status(400).json({ success: false, message: 'Tipo de recurso no válido' });
            }

            if (!isOwner) {
                return res.status(403).json({ success: false, message: 'No tienes permiso para acceder a este recurso' });
            }

            next();
        } catch (error) {
            console.error('Error en validación de ownership:', error);
            res.status(500).json({ success: false, message: 'Error interno del servidor' });
        }
    };
}

// Content Security Policy middleware - Más estricto para producción
function setCSP(req, res, next) {
    const isProduction = process.env.NODE_ENV === 'production';

    const csp = [
        "default-src 'self'",
        // En desarrollo permitimos más para facilitar el desarrollo
        isProduction
            ? "script-src 'self' https://js.stripe.com https://www.mercadopago.com.ar"
            : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.mercadopago.com.ar",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.mercadopago.com https://www.mercadopago.com.ar wss: ws:",
        "frame-src 'self' https://js.stripe.com https://www.mercadopago.com.ar",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "media-src 'self'",
        "manifest-src 'self'",
        // Reportar violaciones de CSP
        "report-uri /api/csp-report"
    ].join('; ');

    res.setHeader('Content-Security-Policy', csp);
    next();
}

module.exports = {
    generateCSRFToken,
    csrfProtection,
    setCSRFToken,
    sanitizeInput,
    createRateLimit,
    authRateLimit,
    apiRateLimit,
    fileUploadRateLimit,
    authSlowDown,
    validateFileUpload,
    DataEncryption,
    SecurityLogger,
    requireOwnership,
    setCSP
};
