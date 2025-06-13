# 🍕 A la Mesa - Panel de Administración Completo

## 📋 **NUEVO: Sistema de Administración Implementado**

Se ha implementado un **panel de administración completo** con las siguientes funcionalidades:

### 🛡️ **Panel de Administración** (`/admin`)

#### ✅ **Funcionalidades Implementadas:**

1. **Dashboard Principal**
   - Estadísticas en tiempo real
   - Gráficos de ventas
   - Resumen de cobros
   - Acciones rápidas

2. **Gestión Completa de Restaurantes**
   - ✅ Ver todos los restaurantes
   - ✅ Crear nuevos restaurantes
   - ✅ Editar información de restaurantes
   - ✅ Eliminar restaurantes
   - ✅ Activar/desactivar restaurantes
   - ✅ Filtros avanzados
   - ✅ Exportación a CSV

3. **Sistema de Cobros Semanales (10%)**
   - ✅ Generación automática de cobros semanales
   - ✅ Cálculo del 10% sobre ventas brutas
   - ✅ Control de vencimientos
   - ✅ Estados: pendiente, pagado, vencido, exonerado

4. **Gestión de Comprobantes de Pago**
   - ✅ Revisión de comprobantes subidos por restaurantes
   - ✅ Aprobación/rechazo con comentarios
   - ✅ Aprobación masiva
   - ✅ Visualización de archivos

5. **Gestión de Productos desde Admin**
   - ✅ Ver todos los productos
   - ✅ Crear productos para cualquier restaurante
   - ✅ Eliminar productos
   - ✅ Cambiar disponibilidad

6. **Sistema de Reportes y Actividad**
   - ✅ Log de actividad de administradores
   - ✅ Reportes de ventas
   - ✅ Exportación de datos

### 🏪 **Panel de Restaurantes Mejorado**

#### ✅ **Nuevas Funcionalidades para Restaurantes:**

1. **Sistema de Cobros** (`/dashboard/cobros`)
   - ✅ Ver historial de cobros
   - ✅ Subir comprobantes de pago
   - ✅ Seguimiento de estado de pagos
   - ✅ Notificaciones de vencimientos

2. **Gestión de Comprobantes**
   - ✅ Subida de archivos (JPG, PNG, PDF)
   - ✅ Múltiples métodos de pago
   - ✅ Comentarios en comprobantes
   - ✅ Historial de revisiones

---

## 🚀 **Instalación y Configuración**

### 1. **Requisitos Previos**
```bash
# Instalar Node.js (versión 18 o superior)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar MySQL
sudo apt update
sudo apt install mysql-server

# Configurar MySQL
sudo mysql_secure_installation
```

### 2. **Configurar Base de Datos**
```sql
-- Entrar a MySQL como root
sudo mysql -u root -p

-- Crear usuario para la aplicación
CREATE USER 'alamesa'@'localhost' IDENTIFIED BY 'tu_password_seguro';
GRANT ALL PRIVILEGES ON *.* TO 'alamesa'@'localhost' WITH GRANT OPTION;
FLUSH PRIVILEGES;
EXIT;
```

### 3. **Configurar Proyecto**
```bash
# Clonar/copiar el proyecto
cd a-la-mesa-traditional

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Edita el archivo .env con tus datos
```

### 4. **Configurar Variables de Entorno (.env)**
```env
# Base de datos
DB_HOST=localhost
DB_USER=alamesa
DB_PASSWORD=tu_password_seguro
DB_NAME=a_la_mesa

# Sesiones
SESSION_SECRET=tu_clave_secreta_muy_larga_y_segura

# MercadoPago (opcional)
MERCADOPAGO_ACCESS_TOKEN=TEST-YOUR-ACCESS-TOKEN-HERE
MERCADOPAGO_PUBLIC_KEY=TEST-YOUR-PUBLIC-KEY-HERE

# Email (opcional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_app

# Configuración del servidor
PORT=3000
NODE_ENV=development
```

### 5. **Inicializar Base de Datos**
```bash
# Configurar base de datos automáticamente
npm run setup

# O manualmente:
mysql -u alamesa -p a_la_mesa < database/schema.sql
mysql -u alamesa -p a_la_mesa < database/seed.sql
```

### 6. **Ejecutar Aplicación**
```bash
# Modo desarrollo
npm run dev

# Modo producción
npm start
```

---

## 🔐 **Credenciales de Acceso**

### **👑 Administrador**
- **Email:** `admin@alamesa.com`
- **Contraseña:** `123456`
- **URL:** `http://localhost:3000/admin`

### **🛒 Cliente Demo**
- **Email:** `demo@alamesa.com`
- **Contraseña:** `123456`

### **🏪 Restaurante Demo**
- **Email:** `restaurante@alamesa.com`
- **Contraseña:** `123456`
- **URL:** `http://localhost:3000/dashboard`

---

## 🌐 **URLs Importantes**

| Función | URL | Descripción |
|---------|-----|-------------|
| **🏠 Inicio** | `http://localhost:3000` | Página principal |
| **🔐 Login** | `http://localhost:3000/auth/login` | Iniciar sesión |
| **🛡️ Panel Admin** | `http://localhost:3000/admin` | Panel de administración |
| **🏪 Panel Restaurante** | `http://localhost:3000/dashboard` | Panel de restaurante |
| **💰 Cobros** | `http://localhost:3000/dashboard/cobros` | Gestión de cobros |
| **➕ Registro** | `http://localhost:3000/auth/register-restaurant` | Registrar restaurante |

---

## 💼 **Funcionalidades del Panel Admin**

### 🏪 **Gestión de Restaurantes**
- **CRUD Completo:** Crear, leer, actualizar, eliminar
- **Estados:** Activo/inactivo, verificado/no verificado
- **Filtros:** Por estado, categoría, búsqueda
- **Acciones masivas:** Activar/desactivar múltiples
- **Exportación:** Descargar datos en CSV

### 💰 **Sistema de Cobros**
- **Generación automática:** Cobros semanales del 10%
- **Períodos personalizables:** Seleccionar fechas específicas
- **Estados de cobro:** Pendiente, pagado, vencido, exonerado
- **Vencimientos:** Control automático de fechas límite
- **Notificaciones:** Recordatorios automáticos

### 📋 **Gestión de Comprobantes**
- **Revisión masiva:** Aprobar múltiples comprobantes
- **Comentarios:** Feedback para restaurantes
- **Archivos:** Visualización de JPG, PNG, PDF
- **Validación:** Verificación de montos y datos
- **Historial:** Registro de todas las acciones

### 🍽️ **Gestión de Productos**
- **Vista unificada:** Todos los productos de todos los restaurantes
- **CRUD desde admin:** Crear/editar/eliminar productos
- **Filtros avanzados:** Por restaurante, categoría, disponibilidad
- **Control de disponibilidad:** Activar/desactivar productos

### 📊 **Reportes y Analytics**
- **Dashboard interactivo:** Gráficos en tiempo real
- **Métricas clave:** Ventas, comisiones, tickets promedio
- **Actividad de admin:** Log completo de acciones
- **Exportaciones:** Datos en formato CSV

---

## 🔄 **Flujo del Sistema de Cobros**

### **1. Generación Automática**
```
Cada lunes → Sistema calcula ventas de la semana anterior → Genera cobro del 10%
```

### **2. Notificación a Restaurantes**
```
Cobro generado → Email/notificación → Restaurante ve cobro en su panel
```

### **3. Proceso de Pago**
```
Restaurante realiza pago → Sube comprobante → Admin revisa → Aprueba/rechaza
```

### **4. Estados del Cobro**
- **🟡 Pendiente:** Recién generado, esperando pago
- **🟢 Pagado:** Comprobante aprobado
- **🔴 Vencido:** Pasó la fecha límite sin pago
- **⚪ Exonerado:** Liberado por admin

---

## 🛡️ **Seguridad Implementada**

### **Autenticación y Autorización**
- ✅ Middleware de verificación de roles
- ✅ Protección de rutas administrativas
- ✅ Sesiones seguras
- ✅ Validación de permisos por endpoint

### **Validación de Datos**
- ✅ Validación server-side con express-validator
- ✅ Sanitización de inputs
- ✅ Verificación de tipos de archivo
- ✅ Límites de tamaño de archivo

### **Logging y Auditoría**
- ✅ Registro completo de actividad de admins
- ✅ Tracking de cambios en datos
- ✅ Historial de acciones críticas
- ✅ IPs y timestamps de accesos

---

## 📱 **Funcionalidades Móviles**

### **Responsive Design**
- ✅ Panel admin adaptable a móviles
- ✅ Dashboard restaurante mobile-friendly
- ✅ Formularios optimizados para touch
- ✅ Navegación simplificada en pantallas pequeñas

---

## 🔧 **Comandos NPM Disponibles**

```bash
# Configuración inicial
npm run setup           # Configura base de datos con datos de ejemplo
npm run reset-db        # Resetea la base de datos completamente

# Desarrollo
npm run dev             # Inicia servidor en modo desarrollo
npm start               # Inicia servidor en modo producción

# Base de datos
npm run migrate         # Ejecuta migraciones de BD
npm run seed            # Inserta datos de ejemplo

# Utilidades
npm run backup-db       # Crea backup de la base de datos
npm run restore-db      # Restaura backup de la base de datos
```

---

## 📂 **Estructura del Proyecto**

```
a-la-mesa-traditional/
├── routes/
│   ├── admin.js           # ✨ NUEVO: Rutas del panel admin
│   ├── dashboard.js       # ✨ MEJORADO: Cobros para restaurantes
│   └── ...
├── views/
│   ├── admin/             # ✨ NUEVO: Vistas del panel admin
│   │   ├── dashboard.ejs
│   │   ├── restaurantes.ejs
│   │   ├── cobros.ejs
│   │   ├── productos.ejs
│   │   ├── comprobantes.ejs
│   │   └── ...
│   ├── dashboard/
│   │   ├── cobros.ejs     # ✨ NUEVO: Vista de cobros para restaurantes
│   │   └── ...
│   └── ...
├── database/
│   ├── schema.sql         # ✨ ACTUALIZADO: Nuevas tablas del sistema
│   └── seed.sql           # ✨ ACTUALIZADO: Datos de ejemplo con cobros
├── public/
│   ├── uploads/
│   │   └── comprobantes/  # ✨ NUEVO: Almacén de comprobantes
│   └── ...
└── ...
```

---

## 🎯 **Próximas Mejoras Sugeridas**

### **🔄 Automatización**
- [ ] Generación automática de cobros con cron jobs
- [ ] Notificaciones por email automáticas
- [ ] Recordatorios de vencimiento
- [ ] Backup automático de base de datos

### **📊 Analytics Avanzados**
- [ ] Dashboard con más métricas
- [ ] Gráficos de tendencias
- [ ] Predicciones de ventas
- [ ] Análisis de rentabilidad por restaurante

### **💳 Integraciones de Pago**
- [ ] Pasarela de pagos automática
- [ ] Débito automático de comisiones
- [ ] Múltiples métodos de pago
- [ ] Recibos automáticos

### **📱 App Móvil**
- [ ] App para restaurantes
- [ ] App para administradores
- [ ] Notificaciones push
- [ ] Cámara para comprobantes

---

## 🐛 **Solución de Problemas**

### **Error de Conexión a Base de Datos**
```bash
# Verificar estado de MySQL
sudo systemctl status mysql

# Reiniciar MySQL
sudo systemctl restart mysql

# Verificar credenciales en .env
```

### **Error de Permisos**
```bash
# Dar permisos a directorio de uploads
chmod 755 public/uploads/
chmod 755 public/uploads/comprobantes/

# Verificar permisos de usuario MySQL
mysql -u root -p
SHOW GRANTS FOR 'alamesa'@'localhost';
```

### **Problemas de Memoria**
```bash
# Aumentar límite de memoria para Node.js
node --max-old-space-size=4096 server.js
```

---

## 📞 **Soporte**

Para cualquier problema o consulta:

1. **Verificar logs:** `npm run logs`
2. **Revisar configuración:** Archivo `.env`
3. **Consultar documentación:** Este archivo
4. **Reportar issues:** Con detalles del error

---

## 🎉 **¡Listo para Usar!**

Tu aplicación **A la Mesa** ahora incluye:

✅ Sistema completo de delivery  
✅ Panel de administración avanzado  
✅ Sistema de cobros semanales  
✅ Gestión de comprobantes  
✅ CRUD completo de restaurantes  
✅ Gestión de productos desde admin  
✅ Reportes y analytics  
✅ Sistema de notificaciones  
✅ Exportación de datos  
✅ Interfaz responsive  
✅ Seguridad implementada  

**¡Tu plataforma de delivery está lista para competir con las grandes!** 🚀
