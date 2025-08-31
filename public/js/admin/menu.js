// Admin Menu - JavaScript Optimizado (Sin jQuery)

document.addEventListener('DOMContentLoaded', function() {
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.overlay');
    const closeBtn = document.querySelector('.close-admin-sidebar-mobile');
    const sidebarLinks = document.querySelectorAll('.components a');
    const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
    
    // Botón para abrir/cerrar el sidebar
    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            sidebar.classList.toggle('active');
            overlay.classList.toggle('active');
        });
    }

    // Cerrar el sidebar cuando se hace clic en el overlay
    if (overlay && sidebar) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    // Cerrar el sidebar cuando se hace clic en un enlace
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (sidebar) sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // Manejar submenus con Bootstrap collapse
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const collapseElement = this.nextElementSibling;
            if (collapseElement && collapseElement.classList.contains('collapse')) {
                // Usar Bootstrap Collapse si está disponible
                if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
                    const collapse = new bootstrap.Collapse(collapseElement);
                    collapse.toggle();
                } else {
                    // Fallback manual
                    collapseElement.classList.toggle('show');
                }
            }
        });
    });
    
    // Cerrar sidebar con botón de cerrar
    if (closeBtn && sidebar && overlay) {
        closeBtn.addEventListener('click', function() {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
});
