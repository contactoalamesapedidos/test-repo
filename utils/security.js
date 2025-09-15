const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DataEncryption, SecurityLogger } = require('../middleware/security');

// Initialize security logger
const securityLogger = new SecurityLogger();
const dataEncryption = new DataEncryption();

// Password utilities
class PasswordUtils {
    static async hashPassword(password) {
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

    static async verifyPassword(password, hash) {
        return await bcrypt.compare(password, hash);
    }

    static generateSecurePassword(length = 12) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    static validatePasswordStrength(password) {
        const errors = [];

        if (password.length < 8) {
            errors.push('La contraseña debe tener al menos 8 caracteres');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('La contraseña debe contener al menos una letra mayúscula');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('La contraseña debe contener al menos una letra minúscula');
        }

        if (!/\d/.test(password)) {
            errors.push('La contraseña debe contener al menos un número');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('La contraseña debe contener al menos un carácter especial');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Token utilities
class TokenUtils {
    static generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    static generateJWT(payload, secret, expiresIn = '24h') {
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const exp = now + (expiresIn === '24h' ? 86400 : 3600);

        const jwtPayload = {
            ...payload,
            iat: now,
            exp: exp
        };

        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');

        const data = `${encodedHeader}.${encodedPayload}`;
        const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url');

        return `${data}.${signature}`;
    }

    static verifyJWT(token, secret) {
        try {
            const [header, payload, signature] = token.split('.');

            const expectedSignature = crypto.createHmac('sha256', secret)
                .update(`${header}.${payload}`)
                .digest('base64url');

            if (signature !== expectedSignature) {
                return { valid: false, error: 'Invalid signature' };
            }

            const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());

            if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
                return { valid: false, error: 'Token expired' };
            }

            return { valid: true, payload: decodedPayload };
        } catch (error) {
            return { valid: false, error: 'Invalid token format' };
        }
    }
}

// API Key utilities
class APIKeyUtils {
    static generateAPIKey() {
        const prefix = 'ak_';
        const key = crypto.randomBytes(32).toString('hex');
        return prefix + key;
    }

    static hashAPIKey(apiKey) {
        return crypto.createHash('sha256').update(apiKey).digest('hex');
    }

    static verifyAPIKey(providedKey, storedHash) {
        const providedHash = this.hashAPIKey(providedKey);
        return crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );
    }
}

// Encryption utilities for sensitive data
class SensitiveDataUtils {
    static async encryptSensitiveData(data, encryptionKey) {
        return dataEncryption.encrypt(JSON.stringify(data), encryptionKey);
    }

    static async decryptSensitiveData(encryptedData, encryptionKey) {
        try {
            const decrypted = dataEncryption.decrypt(encryptedData, encryptionKey);
            return JSON.parse(decrypted);
        } catch (error) {
            securityLogger.log('error', 'Failed to decrypt sensitive data', { error: error.message });
            throw new Error('Failed to decrypt data');
        }
    }

    static maskSensitiveData(data, visibleChars = 4) {
        if (!data || typeof data !== 'string') return data;

        if (data.length <= visibleChars * 2) {
            return '*'.repeat(data.length);
        }

        const start = data.substring(0, visibleChars);
        const end = data.substring(data.length - visibleChars);
        const maskLength = data.length - (visibleChars * 2);

        return start + '*'.repeat(maskLength) + end;
    }
}

// Security audit utilities
class SecurityAuditUtils {
    static async logSecurityEvent(event, details, req = null) {
        const auditData = {
            event,
            details,
            timestamp: new Date().toISOString(),
            ip: req ? this.getClientIP(req) : 'unknown',
            userAgent: req ? req.get('User-Agent') : 'unknown',
            userId: req && req.session && req.session.user ? req.session.user.id : 'anonymous'
        };

        securityLogger.logSecurityEvent(event, auditData);
        return auditData;
    }

    static getClientIP(req) {
        const forwarded = req.get('x-forwarded-for');
        const realIP = req.get('x-real-ip');
        const clientIP = req.get('x-client-ip');

        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }

        return realIP || clientIP || req.ip || req.connection.remoteAddress;
    }

    static detectSuspiciousActivity(req, activityType) {
        const ip = this.getClientIP(req);
        const userAgent = req.get('User-Agent') || '';
        const userId = req.session && req.session.user ? req.session.user.id : 'anonymous';

        // Basic suspicious activity detection
        const suspiciousPatterns = {
            brute_force: req.method === 'POST' && req.path.includes('/login'),
            unusual_traffic: req.get('referer') === undefined,
            automated_requests: !userAgent || userAgent.includes('bot') || userAgent.includes('crawler')
        };

        if (suspiciousPatterns[activityType]) {
            securityLogger.logSuspiciousActivity(userId, activityType, {
                ip,
                userAgent,
                path: req.path,
                method: req.method
            });
            return true;
        }

        return false;
    }
}

// Input validation utilities
class ValidationUtils {
    static sanitizeEmail(email) {
        return email.toLowerCase().trim();
    }

    static validateEmailFormat(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    static sanitizePhoneNumber(phone) {
        // Remove all non-numeric characters except + and spaces
        return phone.replace(/[^\d+\s-()]/g, '').trim();
    }

    static validatePhoneNumber(phone) {
        // Basic phone validation (adjust regex based on your needs)
        const phoneRegex = /^[\+]?[\d\s\-\(\)]{8,}$/;
        return phoneRegex.test(phone);
    }

    static sanitizeAddress(address) {
        // Remove potentially dangerous characters but keep common address characters
        return address.replace(/[<>\"'&]/g, '').trim();
    }

    static validateURL(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    static sanitizeSQLInput(input) {
        // Basic SQL injection prevention (use prepared statements instead)
        return input.replace(/['";\\]/g, '').trim();
    }
}

// Rate limiting utilities
class RateLimitUtils {
    static createCustomRateLimit(options) {
        const { windowMs, max, message, skipSuccessfulRequests, skipFailedRequests } = options;

        return {
            windowMs: windowMs || 15 * 60 * 1000, // 15 minutes
            max: max || 100,
            message: message || { success: false, message: 'Demasiadas solicitudes' },
            standardHeaders: true,
            legacyHeaders: false,
            skip: (req, res) => {
                // Skip for admin users
                if (req.session && req.session.user && req.session.user.tipo_usuario === 'admin') {
                    return true;
                }

                // Skip based on success/failure if specified
                if (skipSuccessfulRequests && res.statusCode < 400) {
                    return true;
                }

                if (skipFailedRequests && res.statusCode >= 400) {
                    return true;
                }

                return false;
            }
        };
    }

    static createBruteForceProtection() {
        return this.createCustomRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5, // 5 attempts
            message: { success: false, message: 'Demasiados intentos fallidos. Intente más tarde.' }
        });
    }
}

// Session security utilities
class SessionUtils {
    static generateSecureSessionId() {
        return crypto.randomBytes(32).toString('hex');
    }

    static validateSessionFingerprint(req) {
        const currentFingerprint = this.generateFingerprint(req);
        const storedFingerprint = req.session.fingerprint;

        if (!storedFingerprint) {
            req.session.fingerprint = currentFingerprint;
            return true;
        }

        return currentFingerprint === storedFingerprint;
    }

    static generateFingerprint(req) {
        const userAgent = req.get('User-Agent') || '';
        const ip = SecurityAuditUtils.getClientIP(req);
        const acceptLanguage = req.get('accept-language') || '';

        const fingerprint = crypto.createHash('sha256')
            .update(userAgent + ip + acceptLanguage)
            .digest('hex');

        return fingerprint;
    }

    static destroyAllUserSessions(db, userId, currentSessionId) {
        // This would require a sessions table in the database
        // Implementation depends on your session store
        return true;
    }
}

module.exports = {
    PasswordUtils,
    TokenUtils,
    APIKeyUtils,
    SensitiveDataUtils,
    SecurityAuditUtils,
    ValidationUtils,
    RateLimitUtils,
    SessionUtils,
    securityLogger,
    dataEncryption
};
