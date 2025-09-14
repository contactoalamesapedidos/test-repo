@echo off
echo 🚀 === DESPLIEGUE AUTOMÁTICO A VERCEL ===
echo.

REM Verificar si estamos en el directorio correcto
if not exist "server.js" (
    echo ❌ Error: No estás en el directorio del proyecto
    echo.
    echo 💡 Asegúrate de estar en el directorio que contiene server.js
    echo    Ruta correcta: c:\Users\USER\Documents\Tools\a-la-mesa 2.0 - copia (5) - copia
    echo.
    pause
    exit /b 1
)

echo ✅ Directorio correcto verificado
echo.

REM Verificar si Vercel CLI está instalado
echo 🔧 Verificando Vercel CLI...
vercel --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Vercel CLI no encontrado. Instalando...
    echo.
    echo 💡 Si te pide permisos de administrador, acepta.
    echo.
    npm install -g vercel
    if errorlevel 1 (
        echo ❌ Error instalando Vercel CLI
        echo.
        echo 💡 Intenta ejecutar como administrador:
        echo    npm install -g vercel
        echo.
        pause
        exit /b 1
    )
    echo ✅ Vercel CLI instalado correctamente
) else (
    echo ✅ Vercel CLI ya está instalado
)
echo.

REM Verificar si estamos logueados en Vercel
echo 🔐 Verificando login en Vercel...
vercel whoami >nul 2>&1
if errorlevel 1 (
    echo 🔑 Necesitas hacer login en Vercel
    echo.
    echo 💡 Se abrirá tu navegador para autenticarte
    echo    Si no se abre automáticamente, ve a: https://vercel.com/login
    echo.
    vercel login
    if errorlevel 1 (
        echo ❌ Error en el login de Vercel
        pause
        exit /b 1
    )
    echo ✅ Login exitoso
) else (
    echo ✅ Ya estás logueado en Vercel
)
echo.

REM Verificar si hay cambios sin commitear
echo 📝 Verificando cambios en Git...
git diff --quiet >nul 2>&1
if errorlevel 1 (
    echo ⚠️ Hay cambios sin commitear
    echo.
    echo 📝 Commiteando cambios automáticamente...
    git add .
    if errorlevel 1 (
        echo ❌ Error agregando archivos a Git
        pause
        exit /b 1
    )

    git commit -m "feat: mejoras notificaciones push y limpieza para Vercel"
    if errorlevel 1 (
        echo ❌ Error creando commit
        pause
        exit /b 1
    )

    echo 📤 Subiendo cambios a GitHub...
    git push origin main
    if errorlevel 1 (
        echo ❌ Error subiendo a GitHub
        echo.
        echo 💡 Verifica que tu repositorio esté configurado correctamente
        pause
        exit /b 1
    )
    echo ✅ Cambios subidos a GitHub
) else (
    echo ✅ No hay cambios pendientes
)
echo.

REM Verificar si el proyecto ya está vinculado
if not exist ".vercel" (
    echo 🔗 Vinculando proyecto con Vercel...
    echo.
    echo 💡 Si es la primera vez, selecciona tu repositorio de GitHub
    echo.
    vercel link
    if errorlevel 1 (
        echo ❌ Error vinculando proyecto
        echo.
        echo 💡 Asegúrate de que el repositorio existe en GitHub
        pause
        exit /b 1
    )
    echo ✅ Proyecto vinculado correctamente
) else (
    echo ✅ Proyecto ya vinculado con Vercel
)
echo.

REM Desplegar a producción
echo 🚀 Iniciando despliegue a producción...
echo.
echo 💡 Esto puede tomar unos minutos...
echo.

vercel --prod
if errorlevel 1 (
    echo ❌ Error en el despliegue
    echo.
    echo 💡 Revisa los logs de error arriba
    echo 💡 Si el problema persiste, intenta: vercel --prod --force
    pause
    exit /b 1
)

echo.
echo 🎉 ¡DESPLIEGUE COMPLETADO EXITOSAMENTE!
echo.
echo 🌐 Tu aplicación está ahora disponible en la URL que aparece arriba
echo.
echo 🧪 PRUEBAS IMPORTANTES:
echo    • Sitio principal: TU_URL
echo    • Debug notificaciones: TU_URL/push-debug
echo    • Dashboard: TU_URL/dashboard
echo.
echo ⚙️ CONFIGURACIÓN PENDIENTE:
echo    • Ve a Vercel Dashboard ^> Project Settings ^> Environment Variables
echo    • Agrega las variables requeridas (DATABASE_URL, VAPID keys, etc.)
echo.
echo 📚 GUÍAS DISPONIBLES:
echo    • DEPLOY-QUICKSTART.md - Guía rápida
echo    • README-VERCEL.md - Guía completa
echo.
echo 💡 Si tienes problemas, revisa las guías o ejecuta: vercel logs
echo.
pause
