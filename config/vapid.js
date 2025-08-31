const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const vapidKeysPath = path.join(__dirname, 'vapid-keys.json');

// Función para generar o cargar claves VAPID
function getVapidKeys() {
    try {
        // Intentar cargar claves existentes
        if (fs.existsSync(vapidKeysPath)) {
            const keys = JSON.parse(fs.readFileSync(vapidKeysPath, 'utf8'));
            console.log('Claves VAPID cargadas desde archivo');
            return keys;
        }
    } catch (error) {
        console.error('Error cargando claves VAPID:', error);
    }

    // Generar nuevas claves si no existen
    console.log('Generando nuevas claves VAPID...');
    const vapidKeys = webpush.generateVAPIDKeys();
    
    try {
        fs.writeFileSync(vapidKeysPath, JSON.stringify(vapidKeys, null, 2));
        console.log('Nuevas claves VAPID guardadas');
    } catch (error) {
        console.error('Error guardando claves VAPID:', error);
    }

    return vapidKeys;
}

const vapidKeys = getVapidKeys();

// Configurar web-push
webpush.setVapidDetails(
    'mailto:admin@a-la-mesa.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

module.exports = {
    vapidKeys,
    webpush
}; 