# 📊 Tabla Semanal de Pagos - Panel de Administración

## 🎯 **Descripción de la Funcionalidad**

Se ha implementado una **tabla semanal de pagos** en el panel de administración que permite a los administradores visualizar y gestionar todos los pagos y comisiones de restaurantes organizados por semanas del año.

## ✨ **Características Principales**

### 📅 **Organización por Semanas**
- **Vista semanal**: Cada fila representa una semana del año
- **Numeración automática**: Semana 1, Semana 2, etc.
- **Períodos claros**: Fechas de inicio y fin de cada semana
- **Filtro por año**: Selección de año específico (2020 hasta actual)

### 🏪 **Gestión por Restaurante**
- **Filtro por restaurante**: Ver todos o un restaurante específico
- **Información completa**: Nombre, ID, ubicación del restaurante
- **Estado individual**: Cada semana tiene su propio estado de pago

### 💰 **Información Financiera**
- **Ventas brutas**: Monto total de ventas de la semana
- **Comisión (10%)**: Cálculo automático del 10% sobre ventas
- **Monto pagado**: Cantidad efectivamente pagada
- **Comprobantes**: Número de comprobantes subidos
- **Estado del pago**: Pagado, Pendiente, Vencido, Exonerado

### 📊 **Resumen Anual**
- **Total pagado**: Suma de todas las comisiones pagadas
- **Total pendiente**: Suma de comisiones por pagar
- **Total exonerado**: Comisiones exoneradas
- **Total comisiones**: Suma total de todas las comisiones
- **Cantidad de restaurantes**: Número de restaurantes activos

## 🚀 **Cómo Acceder**

### **1. Desde el Sidebar del Admin**
```
Panel Admin → Tabla Semanal
```

### **2. Desde la Gestión de Cobros**
```
Panel Admin → Cobros → "Ver Tabla Semanal"
```

### **3. URL Directa**
```
http://localhost:3000/admin/pagos-semanales
```

## 🔧 **Funcionalidades Técnicas**

### **Filtros Disponibles**
- **Año**: Selección del año a visualizar
- **Restaurante**: Filtro por restaurante específico
- **Estado**: Visualización de todos los estados

### **Exportación de Datos**
- **Formato CSV**: Descarga directa de la tabla
- **Filtros aplicados**: Respeta los filtros seleccionados
- **Nombre del archivo**: `pagos-semanales-YYYY.csv`

### **Gráficos Visuales**
- **Gráfico de líneas**: Evolución de comisiones por semana
- **Gráfico circular**: Distribución por estado de pagos
- **Responsive**: Se adapta a diferentes tamaños de pantalla

## 📋 **Estructura de la Tabla**

| Columna | Descripción | Formato |
|---------|-------------|---------|
| **Semana** | Número de semana del año | Semana 1, Semana 2, etc. |
| **Período** | Fechas de inicio y fin | DD/MM/YYYY - DD/MM/YYYY |
| **Restaurante** | Nombre e ID del restaurante | Nombre (ID: XXX) |
| **Ventas Brutas** | Total de ventas de la semana | $XXX,XXX.XX |
| **Comisión (10%)** | 10% sobre ventas brutas | $XXX,XXX.XX |
| **Monto Pagado** | Cantidad efectivamente pagada | $XXX,XXX.XX |
| **Estado** | Estado actual del pago | Badge con color |
| **Vencimiento** | Fecha de vencimiento | DD/MM/YYYY |
| **Acciones** | Botones de acción | Ver detalle, Revisar |

## 🎨 **Estados y Colores**

### **Estados de Pago**
- 🟢 **Pagado**: Verde - Pago completado y verificado
- 🟡 **Pendiente**: Amarillo - Pago pendiente de realizar
- 🔴 **Vencido**: Rojo - Pago vencido sin realizar
- 🔵 **Exonerado**: Azul - Pago exonerado por administración

### **Colores de Filas**
- **Fila verde**: Pago completado
- **Fila roja**: Pago vencido
- **Fila azul**: Pago exonerado
- **Fila normal**: Pago pendiente

## 📱 **Responsive Design**

### **Desktop (>768px)**
- Tabla completa con todas las columnas
- Gráficos lado a lado
- Filtros en línea

### **Mobile (≤768px)**
- Tabla con scroll horizontal
- Gráficos apilados verticalmente
- Filtros en columna

## 🔗 **Navegación Integrada**

### **Enlaces de Acción**
- **Ver detalle**: Lleva a `/admin/cobros/:id`
- **Revisar comprobantes**: Lleva a `/admin/comprobantes?cobro_id=:id`
- **Volver a cobros**: Regresa a la gestión de cobros

### **Breadcrumb**
```
Admin → Tabla Semanal de Pagos
```

## 📈 **Gráficos y Estadísticas**

### **Gráfico de Líneas**
- **Eje X**: Número de semana
- **Eje Y**: Monto en pesos
- **Líneas**: Comisión total vs. Monto pagado
- **Tooltips**: Información detallada al hacer hover

### **Gráfico Circular**
- **Secciones**: Pagado, Pendiente, Vencido, Exonerado
- **Porcentajes**: Distribución porcentual de cada estado
- **Colores**: Consistente con los badges de estado

## 🛠️ **Archivos Implementados**

### **Backend**
- `routes/admin.js`: Ruta `/pagos-semanales` y exportación
- Lógica de cálculo de semanas del año
- Consultas SQL optimizadas

### **Frontend**
- `views/admin/pagos-semanales.ejs`: Vista principal
- `public/css/admin-pagos-semanales.css`: Estilos específicos
- `views/admin/partials/sidebar.ejs`: Enlace en sidebar

### **Base de Datos**
- Tabla `cobros_semanales`: Datos de cobros
- Tabla `comprobantes_pago`: Comprobantes subidos
- Tabla `restaurantes`: Información de restaurantes

## 💡 **Casos de Uso**

### **Para Administradores**
1. **Revisión mensual**: Ver el estado de pagos del mes
2. **Seguimiento anual**: Analizar tendencias de pagos
3. **Identificación de morosos**: Encontrar pagos vencidos
4. **Reportes ejecutivos**: Exportar datos para análisis

### **Para Contadores**
1. **Conciliación bancaria**: Verificar pagos recibidos
2. **Reportes fiscales**: Datos organizados por períodos
3. **Análisis de flujo de caja**: Proyecciones de ingresos

## 🔒 **Seguridad y Permisos**

### **Acceso Restringido**
- Solo usuarios con rol `admin`
- Middleware `requireAdmin` aplicado
- Validación de sesión activa

### **Datos Sensibles**
- Montos de comisiones
- Estados de pagos
- Información de restaurantes

## 🚀 **Próximas Mejoras**

### **Funcionalidades Planificadas**
- [ ] Filtros por rango de fechas
- [ ] Comparación año vs año
- [ ] Alertas de pagos vencidos
- [ ] Notificaciones automáticas
- [ ] Dashboard ejecutivo resumido

### **Optimizaciones Técnicas**
- [ ] Caché de consultas frecuentes
- [ ] Paginación para grandes volúmenes
- [ ] Búsqueda en tiempo real
- [ ] Exportación a Excel/PDF

---

**Fecha de implementación**: 15 de Julio 2025  
**Versión**: 1.0.0  
**Estado**: ✅ COMPLETADO  
**Tipo**: Nueva funcionalidad de administración

