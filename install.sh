#!/bin/bash

# A la Mesa - Script de Instalación Automática
# Este script instala y configura toda la aplicación

echo "🍕 Instalando A la Mesa - Aplicación de Delivery"
echo "=================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir con colores
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    print_error "Este script debe ejecutarse desde el directorio del proyecto"
    exit 1
fi

print_info "Verificando requisitos previos..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instala Node.js v14+ desde https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    print_error "Node.js versión 14+ requerida. Versión actual: $(node -v)"
    exit 1
fi

print_status "Node.js $(node -v) encontrado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    print_error "npm no está instalado"
    exit 1
fi

print_status "npm $(npm -v) encontrado"

# Verificar MySQL
if ! command -v mysql &> /dev/null; then
    print_warning "MySQL no encontrado. Asegúrate de que MySQL esté instalado y ejecutándose"
    print_info "Puedes instalar MySQL desde: https://dev.mysql.com/downloads/"
else
    print_status "MySQL encontrado"
fi

print_info "Instalando dependencias de Node.js..."

# Instalar dependencias
npm install

if [ $? -ne 0 ]; then
    print_error "Error instalando dependencias"
    exit 1
fi

print_status "Dependencias instaladas correctamente"

# Crear directorios necesarios
print_info "Creando directorios necesarios..."

mkdir -p public/uploads
mkdir -p logs

print_status "Directorios creados"

# Configurar variables de entorno
if [ ! -f ".env" ]; then
    print_info "Configurando variables de entorno..."
    cp .env.example .env
    print_status "Archivo .env creado desde .env.example"
    print_warning "IMPORTANTE: Edita el archivo .env con tus datos de MySQL antes de continuar"
else
    print_status "Archivo .env ya existe"
fi

# Verificar y configurar base de datos
print_info "Configuración de base de datos..."

# Pedir credenciales de MySQL si no están en .env
if grep -q "DB_PASSWORD=$" .env; then
    echo ""
    print_warning "Configuración de MySQL requerida"
    read -p "Usuario de MySQL (default: root): " DB_USER
    DB_USER=${DB_USER:-root}
    
    read -s -p "Contraseña de MySQL: " DB_PASSWORD
    echo ""
    
    read -p "Host de MySQL (default: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}
    
    read -p "Puerto de MySQL (default: 3306): " DB_PORT
    DB_PORT=${DB_PORT:-3306}
    
    # Actualizar .env
    sed -i "s/DB_USER=root/DB_USER=$DB_USER/" .env
    sed -i "s/DB_PASSWORD=/DB_PASSWORD=$DB_PASSWORD/" .env
    sed -i "s/DB_HOST=localhost/DB_HOST=$DB_HOST/" .env
    sed -i "s/DB_PORT=3306/DB_PORT=$DB_PORT/" .env
    
    print_status "Configuración de MySQL actualizada en .env"
fi

# Intentar crear la base de datos
print_info "Creando base de datos..."

# Extraer credenciales del .env
DB_USER=$(grep DB_USER .env | cut -d '=' -f2)
DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2)
DB_HOST=$(grep DB_HOST .env | cut -d '=' -f2)

if [ -f "database/schema.sql" ]; then
    mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" < database/schema.sql
    
    if [ $? -eq 0 ]; then
        print_status "Base de datos creada correctamente"
        
        # Insertar datos de ejemplo
        if [ -f "database/seed.sql" ]; then
            print_info "Insertando datos de ejemplo..."
            mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" < database/seed.sql
            
            if [ $? -eq 0 ]; then
                print_status "Datos de ejemplo insertados"
            else
                print_warning "Error insertando datos de ejemplo (puedes hacerlo manualmente)"
            fi
        fi
    else
        print_warning "Error creando base de datos (puedes hacerlo manualmente)"
        print_info "Ejecuta: mysql -u$DB_USER -p < database/schema.sql"
    fi
else
    print_warning "Archivo schema.sql no encontrado"
fi

# Verificar que todos los archivos estén en su lugar
print_info "Verificando instalación..."

REQUIRED_FILES=(
    "server.js"
    "package.json"
    ".env"
    "views/index.ejs"
    "public/css/style.css"
    "public/js/app.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_status "$file ✓"
    else
        print_error "$file no encontrado"
    fi
done

# Mensaje final
echo ""
print_status "🎉 ¡Instalación completada!"
echo ""
print_info "Pasos siguientes:"
echo ""
echo "1. Verifica la configuración en .env (especialmente MySQL)"
echo "2. Ejecuta la aplicación:"
echo "   npm run dev    (para desarrollo)"
echo "   npm start      (para producción)"
echo ""
echo "3. Visita la aplicación:"
echo "   http://localhost:3000"
echo ""
echo "4. Panel de restaurante:"
echo "   http://localhost:3000/dashboard"
echo ""
print_info "Cuentas de prueba:"
echo "   Cliente: demo@alamesa.com / demo123"
echo "   Restaurante: restaurante@alamesa.com / resto123"
echo ""
print_status "¡Disfruta tu nueva aplicación de delivery! 🍕"

# Preguntar si quiere ejecutar la aplicación
echo ""
read -p "¿Quieres ejecutar la aplicación ahora? (y/n): " RUN_APP

if [[ $RUN_APP =~ ^[Yy]$ ]]; then
    print_info "Iniciando la aplicación..."
    npm run dev
fi
