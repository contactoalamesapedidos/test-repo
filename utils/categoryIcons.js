/**
 * Utilidad para obtener el ícono FontAwesome correspondiente a una categoría
 * @param {string} categoryName - Nombre de la categoría
 * @returns {string} - Nombre del ícono FontAwesome
 */
function getCategoryIcon(categoryName) {
    if (!categoryName) return 'utensils';
    
    // Normalizar el nombre (minúsculas, sin acentos)
    const normalizedName = categoryName.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remover acentos
        .trim();
    
    // Mapeo de nombres de categorías a íconos FontAwesome
    const iconMap = {
        // Categorías principales
        'pizzas': 'pizza-slice',
        'pizza': 'pizza-slice',
        'empanadas': 'drumstick-bite',
        'empanada': 'drumstick-bite',
        'sandwiches': 'hamburger',
        'sandwich': 'hamburger',
        'sándwiches': 'hamburger',
        'sándwich': 'hamburger',
        'pastas': 'utensils',
        'pasta': 'utensils',
        'bebidas': 'wine-glass',
        'bebida': 'wine-glass',
        'postres': 'ice-cream',
        'postre': 'ice-cream',
        'hamburguesas': 'hamburger',
        'hamburguesa': 'hamburger',
        'ensaladas': 'leaf',
        'ensalada': 'leaf',
        'parrillas': 'fire',
        'parrilla': 'fire',
        'otros': 'utensils',
        'otro': 'utensils'
    };
    
    return iconMap[normalizedName] || 'utensils';
}

/**
 * Función para usar en EJS templates
 * @param {string} categoryName - Nombre de la categoría
 * @returns {string} - HTML del ícono FontAwesome
 */
function renderCategoryIcon(categoryName, size = '24px', color = 'currentColor') {
    const iconName = getCategoryIcon(categoryName);
    return `<i class="fas fa-${iconName}" style="font-size: ${size}; color: ${color};" class="category-icon"></i>`;
}

/**
 * Función para obtener solo el nombre del ícono (para usar en CSS o JS)
 * @param {string} categoryName - Nombre de la categoría
 * @returns {string} - Nombre del ícono FontAwesome
 */
function getCategoryIconPath(categoryName) {
    return getCategoryIcon(categoryName);
}

/**
 * Utilidad para obtener la ruta de la imagen del ícono de una categoría
 * @param {string} categoryName - Nombre de la categoría
 * @returns {string} - Ruta relativa de la imagen del ícono
 */
function getCategoryImagePath(categoryName) {
    if (!categoryName) return '/images/categories/default_icon.png'; // Fallback image

    const normalizedName = categoryName.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // Remover acentos

    const fileNameMap = {
        'pizzas': 'pizzas.jpg',
        'pizza': 'pizzas.jpg',
        'empanadas': 'empanada icon.png',
        'empanada': 'empanada icon.png',
        'sandwiches': 'sandwich 2 icon.webp',
        'sandwich': 'sandwiches.jpg',
        'sándwiches': 'sandwich 2 icon.webp',
        'sándwich': 'sandwiches.jpg',
        'pastas': 'pastas.jpg',
        'pasta': 'pasta.jpg',
        'bebidas': 'bebidas icono.png',
        'bebida': 'bebidas icono.png',
        'postres': 'postres.jpg',
        'postre': 'postre.jpg',
        'hamburguesas': 'hamburguesa icono.png',
        'hamburguesa': 'hamburguesa icono.png',
        'ensaladas': 'ensaladas.jpg',
        'ensalada': 'ensaladas.jpg',
        'parrillas': 'parrillas.jpg',
        'parrilla': 'parrillas.jpg',
        'otros': 'otros.jpg',
        'otro': 'otros.jpg'
    };

    const fileName = fileNameMap[normalizedName] || 'default_icon.png'; // Fallback if not found in map

    return `/images/categories/${fileName}`;
}


// Exportar para uso en Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCategoryIcon,
        renderCategoryIcon,
        getCategoryIconPath,
        getCategoryImagePath // Add the new function to exports
    };
}

// Exportar para uso en navegador
if (typeof window !== 'undefined') {
    window.CategoryIcons = {
        getCategoryIcon,
        renderCategoryIcon,
        getCategoryIconPath,
        getCategoryImagePath // Add the new function to exports
    };
} 