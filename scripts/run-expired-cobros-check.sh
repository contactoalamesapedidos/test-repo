#!/bin/bash

# Script para ejecutar la verificación de cobros vencidos en Linux/Unix
# Se puede programar con cron para ejecución automática

echo "========================================"
echo "Verificando cobros vencidos - $(date)"
echo "========================================"

# Cambiar al directorio del proyecto
cd "$(dirname "$0")/.."

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encuentra el archivo package.json. Verificar directorio."
    exit 1
fi

# Ejecutar el script de Node.js
echo "Ejecutando verificación de cobros vencidos..."
node scripts/check-expired-cobros.js

EXIT_CODE=$?

echo ""
echo "========================================"
echo "Verificación completada - $(date)"
echo "========================================"

# Salir con el código de salida del script de Node.js
exit $EXIT_CODE
