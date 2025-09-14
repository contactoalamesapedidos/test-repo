@echo off
REM Script batch para ejecutar la verificación de cobros vencidos
REM Se puede programar con el Programador de Tareas de Windows

echo ========================================
echo Verificando cobros vencidos - %DATE% %TIME%
echo ========================================

REM Cambiar al directorio del proyecto
cd /d "%~dp0.."

REM Ejecutar el script de Node.js
node scripts/check-expired-cobros.js

echo.
echo ========================================
echo Verificación completada - %DATE% %TIME%
echo ========================================

REM Pausar para ver los resultados (opcional, quitar en producción)
timeout /t 5 /nobreak > nul

exit /b 0
