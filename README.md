# 🍕 A la Mesa - Aplicación de Delivery Tradicional

Una aplicación completa de delivery de comida desarrollada con tecnologías web tradicionales: **HTML, CSS, JavaScript, Node.js, EJS y MySQL**.

## 🚀 **Configuración Rápida**

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar base de datos automáticamente
npm run setup

# 3. Iniciar aplicación
npm run dev
```

## 🔐 **Credenciales de Prueba**

- **👑 Admin**: `admin@alamesa.com` / `123456`
- **🛒 Cliente**: `demo@alamesa.com` / `123456`  
- **🏪 Restaurante**: `restaurante@alamesa.com` / `123456`

## 🌐 **URLs Importantes**

- **🏠 Inicio**: http://localhost:3000
- **🔐 Login**: http://localhost:3000/auth/login
- **🏪 Panel Restaurante**: http://localhost:3000/dashboard
- **➕ Registro Restaurante**: http://localhost:3000/auth/register-restaurant

## 🚀 Características

- **Frontend**: HTML5, CSS3, JavaScript vanilla, Bootstrap 5, EJS
- **Backend**: Node.js con Express.js
- **Base de datos**: MySQL
- **Tiempo real**: Socket.io
- **Autenticación**: Sessions con express-session
- **Subida de archivos**: Multer
- **Validaciones**: express-validator

## 🛠️ Tecnologías Utilizadas

### Frontend
- HTML5 semántico
- CSS3 con Bootstrap 5
- JavaScript vanilla (sin frameworks)
- EJS como motor de plantillas
- Font Awesome para iconos

### Backend
- Node.js
- Express.js
- EJS (Embedded JavaScript)
- MySQL2
- bcrypt para hash de contraseñas
- express-session para manejo de sesiones
- Socket.io para notificaciones en tiempo real
- Multer para subida de archivos

### Base de Datos
- MySQL
- 20+ tablas relacionales
- Datos de ejemplo incluidos
- Índices optimizados

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- MySQL (v5.7 o superior)
- npm o yarn

## 🔧 Instalación

### 1. Clonar el repositorio
```bash
git clone [url-del-repositorio]
cd a-la-mesa-traditional
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar MySQL
```bash
# Crear base de datos
mysql -u root -p < database/schema.sql

# Insertar datos de ejemplo
mysql -u root -p < database/seed.sql
```

### 4. Configurar variables de entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus datos
nano .env
```

### 5. Configuración del archivo .env
```bash
# Configuración de Base de Datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=a_la_mesa
DB_PORT=3306

# Configuración del Servidor
PORT=3000
NODE_ENV=development

# Session Secret
SESSION_SECRET=tu_secreto_de_session_super_seguro

# Configuración de archivos
UPLOAD_PATH=./public/uploads
MAX_FILE_SIZE=5242880

# URLs
BASE_URL=http://localhost:3000
```

### 6. Crear directorios necesarios
```bash
mkdir -p public/uploads
```

### 7. Iniciar la aplicación
```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

## 🌐 Uso

### URLs Principales

- **Página principal**: http://localhost:3000
- **Login**: http://localhost:3000/auth/login
- **Registro**: http://localhost:3000/auth/register
- **Registro restaurante**: http://localhost:3000/auth/register-restaurant
- **Dashboard restaurante**: http://localhost:3000/dashboard

### Cuentas de Prueba

#### Cliente Demo
- **Email**: demo@alamesa.com
- **Contraseña**: demo123

#### Restaurante Demo
- **Email**: restaurante@alamesa.com
- **Contraseña**: resto123

## 📱 Funcionalidades

### Para Clientes
- ✅ Registro y autenticación
- ✅ Búsqueda de restaurantes
- ✅ Navegación por categorías
- ✅ Carrito de compras
- ✅ Proceso de checkout
- ✅ Historial de pedidos
- ✅ Tracking en tiempo real
- ✅ Sistema de calificaciones

### Para Restaurantes
- ✅ Dashboard completo
- ✅ Gestión de productos
- ✅ Gestión de pedidos
- ✅ Cambio de estados de pedidos
- ✅ Subida de imágenes
- ✅ Estadísticas básicas
- ✅ Notificaciones en tiempo real

### Para Administradores
- ✅ Panel de administración
- ✅ Aprobación de restaurantes
- ✅ Gestión de usuarios
- ✅ Reportes del sistema

## 🗂️ Estructura del Proyecto

```
a-la-mesa-traditional/
├── public/                 # Archivos estáticos
│   ├── css/               # Hojas de estilo
│   ├── js/                # JavaScript del frontend
│   ├── images/            # Imágenes del sitio
│   └── uploads/           # Archivos subidos
├── views/                 # Plantillas EJS
│   ├── partials/          # Parciales reutilizables
│   ├── auth/              # Páginas de autenticación
│   ├── dashboard/         # Panel de restaurante
│   └── orders/            # Páginas de pedidos
├── routes/                # Rutas de Express
│   ├── index.js           # Rutas principales
│   ├── auth.js            # Autenticación
│   ├── restaurants.js     # Restaurantes
│   ├── products.js        # Productos
│   ├── orders.js          # Pedidos
│   ├── cart.js            # Carrito
│   └── dashboard.js       # Panel restaurante
├── middleware/            # Middlewares personalizados
├── config/               # Configuración
│   └── database.js       # Conexión MySQL
├── database/             # Scripts de base de datos
│   ├── schema.sql        # Estructura de la BD
│   └── seed.sql          # Datos de ejemplo
├── server.js             # Servidor principal
├── package.json          # Dependencias
└── README.md             # Este archivo
```

## 🔌 APIs Principales

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/register` - Registro de cliente
- `POST /auth/register-restaurant` - Registro de restaurante
- `POST /auth/logout` - Cerrar sesión

### Restaurantes
- `GET /restaurants` - Lista de restaurantes
- `GET /restaurants/:id` - Detalle de restaurante
- `GET /search` - Búsqueda de restaurantes

### Carrito
- `POST /cart/add` - Agregar al carrito
- `POST /cart/update` - Actualizar cantidad
- `POST /cart/remove` - Eliminar del carrito
- `GET /cart` - Ver carrito

### Pedidos
- `POST /orders/create` - Crear pedido
- `GET /orders` - Historial de pedidos
- `GET /orders/:id` - Detalle de pedido

### Dashboard (Restaurantes)
- `GET /dashboard` - Panel principal
- `GET /dashboard/products` - Gestión de productos
- `POST /dashboard/products/save` - Guardar producto
- `GET /dashboard/orders` - Gestión de pedidos
- `POST /dashboard/orders/:id/status` - Actualizar estado

## 🎨 Personalización

### Cambiar colores
Edita las variables CSS en `public/css/style.css`:

```css
:root {
  --primary-color: #ff6b35;    /* Color principal */
  --secondary-color: #f7931e;  /* Color secundario */
  --success-color: #28a745;    /* Color de éxito */
  --danger-color: #dc3545;     /* Color de error */
}
```

### Agregar nuevas páginas
1. Crear vista EJS en `views/`
2. Agregar ruta en `routes/`
3. Registrar ruta en `server.js`

### Personalizar email templates
Edita las plantillas en `views/emails/`

## 🚦 Scripts de NPM

```bash
npm start          # Iniciar en producción
npm run dev        # Iniciar en desarrollo (nodemon)
npm run install-db # Instalar base de datos
npm run seed-db    # Poblar con datos de ejemplo
```

## 🐛 Solución de Problemas

### Error de conexión a MySQL
```bash
# Verificar que MySQL esté corriendo
sudo service mysql start

# Verificar credenciales en .env
# Asegurarse de que la base de datos existe
```

### Error de permisos en uploads
```bash
chmod 755 public/uploads/
```

### Puerto en uso
```bash
# Cambiar puerto en .env o matar proceso
lsof -ti:3000 | xargs kill -9
```

## 📄 Licencia

MIT License - ve el archivo LICENSE para más detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature
3. Commit tus cambios
4. Push a la rama
5. Abre un Pull Request

## 📞 Soporte

Para soporte o preguntas:
- Email: soporte@alamesa.com
- Issues: [GitHub Issues]

## ✨ Próximas Características

- [ ] Integración con APIs de pago reales
- [ ] Aplicación móvil
- [ ] Sistema de delivery con GPS
- [ ] Analytics avanzados
- [ ] Sistema de cupones automáticos
- [ ] Chat en tiempo real
- [ ] API REST pública

---

**A la Mesa** - Desarrollado con ❤️ usando tecnologías web tradicionales
#   a _ l a _ m e s a _ 3 . 0  
 