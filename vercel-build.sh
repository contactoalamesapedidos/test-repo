#!/bin/bash

# Instalar dependencias
echo "Instalando dependencias..."
npm install

# Configurar variables de entorno si es necesario
if [ ! -f ".env" ]; then
  echo "Creando archivo .env..."
  cp .env.example .env
fi

echo "Compilación completada exitosamente!"
