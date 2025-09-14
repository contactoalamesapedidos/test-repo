#!/bin/bash

echo "🚀 === DESPLIEGUE A VERCEL - A LA MESA ==="
echo ""

# Verificar si estamos en un repositorio git
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: No estás en un repositorio Git"
    exit 1
fi

# Verificar si hay cambios sin commitear
if ! git diff --quiet || ! git diff --staged --quiet; then
    echo "⚠️  Hay cambios sin commitear. ¿Quieres commitearlos primero? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "📝 Commiteando cambios..."
        git add .
        echo "✍️  Ingresa el mensaje del commit:"
        read -r commit_message
        git commit -m "$commit_message"
    fi
fi

# Verificar si Vercel CLI está instalado
if ! command -v vercel &> /dev/null; then
    echo "⚠️  Vercel CLI no está instalado. ¿Quieres instalarlo? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "📦 Instalando Vercel CLI..."
        npm install -g vercel
    else
        echo "❌ Necesitas Vercel CLI para continuar. Instálalo con: npm install -g vercel"
        exit 1
    fi
fi

# Verificar si ya está logueado en Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 No estás logueado en Vercel. Iniciando sesión..."
    vercel login
fi

# Verificar si el proyecto ya está vinculado
if [ ! -f ".vercel/project.json" ]; then
    echo "🔗 Vinculando proyecto con Vercel..."
    vercel link
else
    echo "✅ Proyecto ya vinculado con Vercel"
fi

# Mostrar configuración actual
echo ""
echo "📋 CONFIGURACIÓN ACTUAL:"
echo "🌐 URL de producción: $(vercel domains ls 2>/dev/null | grep -E "(https?://)" | head -1 || echo "No configurada")"
echo ""

# Preguntar si quiere hacer deploy de producción
echo "🎯 ¿Qué tipo de despliegue quieres hacer?"
echo "1) Preview (desarrollo/testing)"
echo "2) Production (producción)"
echo ""
read -r deploy_type

if [ "$deploy_type" = "2" ]; then
    echo "🏭 Desplegando a PRODUCCIÓN..."
    echo "⚠️  Esto sobrescribirá tu sitio en producción. ¿Continuar? (y/n)"
    read -r confirm
    if [[ ! "$confirm" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo "❌ Despliegue cancelado"
        exit 1
    fi

    # Deploy a producción
    echo "🚀 Ejecutando despliegue a producción..."
    vercel --prod

    # Obtener URL de producción
    PROD_URL=$(vercel domains ls 2>/dev/null | grep -E "(https?://)" | head -1)
    if [ -n "$PROD_URL" ]; then
        echo ""
        echo "🎉 ¡DESPLIEGUE COMPLETADO!"
        echo "🌐 URL de producción: $PROD_URL"
        echo ""
        echo "🧪 Para probar las notificaciones push:"
        echo "   $PROD_URL/push-debug"
        echo ""
        echo "⚙️  RECUERDA configurar estas variables de entorno en Vercel:"
        echo "   • NODE_ENV=production"
        echo "   • DATABASE_URL (tu base de datos MySQL)"
        echo "   • VAPID_PUBLIC_KEY (para notificaciones push)"
        echo "   • VAPID_PRIVATE_KEY (para notificaciones push)"
        echo "   • MERCADO_PAGO_ACCESS_TOKEN (opcional)"
        echo "   • SESSION_SECRET (cadena segura aleatoria)"
    fi

else
    echo "🧪 Desplegando a PREVIEW..."
    vercel

    # Obtener URL de preview
    PREVIEW_URL=$(vercel domains ls 2>/dev/null | grep -E "(https?://)" | tail -1)
    if [ -n "$PREVIEW_URL" ]; then
        echo ""
        echo "🎉 ¡DESPLIEGUE DE PREVIEW COMPLETADO!"
        echo "🌐 URL de preview: $PREVIEW_URL"
        echo ""
        echo "🧪 Para probar las notificaciones push:"
        echo "   $PREVIEW_URL/push-debug"
        echo ""
        echo "💡 Cuando estés listo para producción, ejecuta:"
        echo "   vercel --prod"
    fi
fi

echo ""
echo "📚 COMANDOS ÚTILES:"
echo "• Ver logs: vercel logs"
echo "• Ver variables de entorno: vercel env ls"
echo "• Agregar variable: vercel env add VARIABLE_NAME"
echo "• Ver dominios: vercel domains ls"
echo ""
echo "🔧 SI HAY PROBLEMAS CON NOTIFICACIONES:"
echo "1. Ve a: TU_URL/push-debug"
echo "2. Ejecuta: 'Prueba Paso a Paso'"
echo "3. Sigue las instrucciones del diagnóstico"
echo ""
echo "✅ ¡Listo para usar!"
