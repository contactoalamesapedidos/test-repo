#!/usr/bin/env node

/**
 * Script de optimización CSS para A la Mesa
 * Comprime y optimiza archivos CSS para producción
 */

const fs = require('fs');
const path = require('path');
const { minify } = require('csso');

console.log('🚀 Iniciando optimización CSS...\n');

// Directorio de archivos CSS
const cssDir = path.join(__dirname, '..', 'public', 'css');
const outputDir = path.join(cssDir, 'dist');

// Crear directorio de salida si no existe
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Archivos CSS a optimizar
const cssFiles = [
    'variables.css',
    'utilities.css',
    'style.css',
    'admin.css',
    'cart.css',
    'dashboard-orders.css',
    'carousel-home.css'
];

let totalOriginalSize = 0;
let totalOptimizedSize = 0;

console.log('📁 Procesando archivos CSS...\n');

cssFiles.forEach(fileName => {
    const filePath = path.join(cssDir, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Archivo no encontrado: ${fileName}`);
        return;
    }

    try {
        // Leer archivo original
        const originalCss = fs.readFileSync(filePath, 'utf8');
        const originalSize = Buffer.byteLength(originalCss, 'utf8');

        // Optimizar CSS
        const optimizedCss = minify(originalCss).css;
        const optimizedSize = Buffer.byteLength(optimizedCss, 'utf8');

        // Calcular ahorro
        const savings = originalSize - optimizedSize;
        const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

        // Guardar archivo optimizado
        const outputFileName = fileName.replace('.css', '.min.css');
        const outputPath = path.join(outputDir, outputFileName);
        fs.writeFileSync(outputPath, optimizedCss);

        // Actualizar estadísticas
        totalOriginalSize += originalSize;
        totalOptimizedSize += optimizedSize;

        console.log(`✅ ${fileName}`);
        console.log(`   Original: ${originalSize} bytes`);
        console.log(`   Optimizado: ${optimizedSize} bytes`);
        console.log(`   Ahorro: ${savings} bytes (${savingsPercent}%)`);
        console.log('');

    } catch (error) {
        console.error(`❌ Error procesando ${fileName}:`, error.message);
    }
});

// Crear archivo CSS principal optimizado
console.log('📦 Creando archivo CSS principal optimizado...\n');

try {
    const mainCssPath = path.join(cssDir, 'main.css');
    const mainCss = fs.readFileSync(mainCssPath, 'utf8');

    // Reemplazar imports con archivos minificados
    let optimizedMainCss = mainCss
        .replace(/variables\.css/g, 'dist/variables.min.css')
        .replace(/utilities\.css/g, 'dist/utilities.min.css')
        .replace(/style\.css/g, 'dist/style.min.css')
        .replace(/admin\.css/g, 'dist/admin.min.css')
        .replace(/cart\.css/g, 'dist/cart.min.css')
        .replace(/dashboard-orders\.css/g, 'dist/dashboard-orders.min.css')
        .replace(/carousel-home\.css/g, 'dist/carousel-home.min.css');

    // Optimizar el archivo principal
    const finalOptimizedCss = minify(optimizedMainCss).css;
    const mainOutputPath = path.join(outputDir, 'main.min.css');
    fs.writeFileSync(mainOutputPath, finalOptimizedCss);

    const mainOriginalSize = Buffer.byteLength(mainCss, 'utf8');
    const mainOptimizedSize = Buffer.byteLength(finalOptimizedCss, 'utf8');
    const mainSavings = mainOriginalSize - mainOptimizedSize;
    const mainSavingsPercent = ((mainSavings / mainOriginalSize) * 100).toFixed(1);

    console.log('✅ main.css optimizado');
    console.log(`   Original: ${mainOriginalSize} bytes`);
    console.log(`   Optimizado: ${mainOptimizedSize} bytes`);
    console.log(`   Ahorro: ${mainSavings} bytes (${mainSavingsPercent}%)`);
    console.log('');

} catch (error) {
    console.error('❌ Error creando archivo principal optimizado:', error.message);
}

// Estadísticas finales
const totalSavings = totalOriginalSize - totalOptimizedSize;
const totalSavingsPercent = ((totalSavings / totalOriginalSize) * 100).toFixed(1);

console.log('📊 ESTADÍSTICAS FINALES');
console.log('='.repeat(40));
console.log(`Tamaño original total: ${totalOriginalSize} bytes`);
console.log(`Tamaño optimizado total: ${totalOptimizedSize} bytes`);
console.log(`Ahorro total: ${totalSavings} bytes (${totalSavingsPercent}%)`);
console.log('');

console.log('🎉 ¡Optimización CSS completada!');
console.log('');
console.log('📝 Para usar los archivos optimizados:');
console.log('   - Reemplaza las referencias CSS en tus vistas');
console.log('   - Cambia: <link href="/css/main.css" rel="stylesheet">');
console.log('   - Por:    <link href="/css/dist/main.min.css" rel="stylesheet">');
console.log('');
console.log('💡 Los archivos optimizados están en: public/css/dist/');
