document.addEventListener('DOMContentLoaded', function() {
    const banner = document.getElementById('cookieConsentBanner');
    const acceptBtn = document.getElementById('acceptCookieConsent');
    const declineBtn = document.getElementById('declineCookieConsent');

    // Si el banner no existe en el DOM (porque el usuario ya consintió en el backend), no hacer nada.
    if (!banner) {
        return;
    }

    // Función para leer una cookie específica
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Función para establecer una cookie
    function setCookie(name, value, days) {
        const d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        const expires = "expires=" + d.toUTCString();
        document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
    }

    // Función para ocultar el banner con animación
    function hideBanner() {
        banner.classList.add('animate-out');
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }

    // Mostrar el banner si la cookie de consentimiento no existe
    if (!getCookie('cookie_consent')) {
        banner.style.display = 'block';
        // Usamos un pequeño delay para que la transición CSS se aplique correctamente
        setTimeout(() => {
            banner.classList.add('show', 'animate-in');
        }, 100);
    }

    // Listener para el botón de aceptar
    acceptBtn.addEventListener('click', function() {
        // Establecer la cookie para que expire en 1 año
        setCookie('cookie_consent', 'true', 365);
        
        // Ocultar el banner con la transición
        banner.classList.remove('show');
        hideBanner();
    });

    // Listener para el botón de rechazar
    if (declineBtn) {
        declineBtn.addEventListener('click', function() {
            // Establecer la cookie para que expire en 30 días (menos tiempo para rechazo)
            setCookie('cookie_consent', 'false', 30);
            
            // Ocultar el banner con la transición
            banner.classList.remove('show');
            hideBanner();
        });
    }

    // Mejorar la accesibilidad con teclado
    banner.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            // Permitir cerrar con ESC
            if (declineBtn) {
                declineBtn.click();
            } else {
                acceptBtn.click();
            }
        }
    });

    // Focus management para accesibilidad
    acceptBtn.addEventListener('focus', function() {
        banner.setAttribute('aria-label', 'Banner de consentimiento de cookies - Presiona Escape para rechazar');
    });

    if (declineBtn) {
        declineBtn.addEventListener('focus', function() {
            banner.setAttribute('aria-label', 'Banner de consentimiento de cookies - Presiona Escape para rechazar');
        });
    }
}); 