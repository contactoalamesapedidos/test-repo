const nodemailer = require('nodemailer');
const ejs = require('ejs');
const path = require('path');
require('dotenv').config();

// Se centraliza la configuración del transporter para ser usada en toda la aplicación.
// Asegúrate de tener las variables de entorno configuradas en tu archivo .env
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_PORT == 465,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Añadido para mejorar la confiabilidad en algunos entornos
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * Función genérica para enviar correos electrónicos usando plantillas EJS.
 * @param {string} to - Destinatario.
 * @param {string} subject - Asunto.
 * @param {string} template - Nombre de la plantilla EJS (sin la extensión .ejs).
 * @param {object} data - Datos para pasar a la plantilla.
 */
const sendEmail = async (to, subject, template, data) => {
    try {
        const templatePath = path.join(__dirname, '..', 'views', 'emails', `${template}.ejs`);
        const html = await ejs.renderFile(templatePath, {
            ...data,
            webUrl: process.env.BASE_URL || 'https://alamesaargentina.loca.lt'
        });
        // Fallback de texto plano (extraído del HTML) para clientes que no renderizan HTML
        const text = (html || '')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/&nbsp;|&amp;|&quot;|&lt;|&gt;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || subject;

        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'A la Mesa'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
            text,
            attachments: [{
                filename: 'logo.jpeg',
                path: path.join(__dirname, '..', 'public', 'images', 'logo.jpeg'),
                cid: 'logo@alamesa.com' // ID único para la imagen
            }]
        };

        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error(`Error al enviar correo a ${to} usando plantilla ${template}:`, error);
        // No relanzamos el error para no interrumpir flujos críticos como el registro.
    }
};

module.exports = {
    transporter,
    sendEmail
};
