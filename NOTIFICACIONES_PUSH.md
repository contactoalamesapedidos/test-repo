# Sistema de Notificaciones Push - A la Mesa

## Descripción

El sistema de notificaciones push permite a los restaurantes recibir alertas inmediatas cuando llegan nuevos pedidos, incluso cuando no tienen la aplicación abierta. También notifica a los clientes sobre cambios en el estado de sus pedidos.

## Características

- ✅ **Notificaciones push del navegador**: Funciona en Chrome, Firefox, Safari y Edge
- ✅ **Notificaciones de nuevos pedidos**: Para restaurantes
- ✅ **Notificaciones de cambio de estado**: Para clientes
- ✅ **Interfaz de usuario intuitiva**: Botones para habilitar/deshabilitar
- ✅ **Persistencia de suscripciones**: Se guardan en la base de datos
- ✅ **Limpieza automática**: Elimina suscripciones inválidas

## Instalación

### 1. Dependencias

```bash
npm install web-push
```

### 2. Base de datos

Ejecutar la migración:

```bash
mysql -u root -p a_la_mesa < database/migrations/20250116_add_push_subscriptions.sql
```

### 3. Configuración

Las claves VAPID se generan automáticamente en `config/vapid.js` la primera vez que se ejecuta la aplicación.

## Uso

### Para Restaurantes

1. **Habilitar notificaciones**:
   - Ir al dashboard del restaurante
   - En la sección "Notificaciones Push", hacer clic en "Habilitar Notificaciones"
   - El navegador solicitará permisos
   - Confirmar para recibir notificaciones

2. **Recibir notificaciones**:
   - Cuando llegue un nuevo pedido, aparecerá una notificación push
   - Hacer clic en "Ver Pedido" para ir directamente al dashboard de pedidos

3. **Deshabilitar notificaciones**:
   - Hacer clic en "Deshabilitar Notificaciones" en el dashboard

### Para Clientes

1. **Notificaciones automáticas**:
   - Los clientes reciben notificaciones automáticamente cuando el restaurante cambia el estado de su pedido
   - No necesitan configuración adicional

## Archivos del Sistema

### Frontend
- `public/js/push-notifications.js`: Cliente JavaScript para manejar notificaciones
- `public/sw.js`: Service Worker para recibir notificaciones push
- `views/dashboard/index.ejs`: Interfaz de usuario para configurar notificaciones

### Backend
- `routes/push.js`: API para manejar suscripciones y enviar notificaciones
- `config/vapid.js`: Configuración de claves VAPID
- `database/migrations/20250116_add_push_subscriptions.sql`: Tabla de suscripciones

### Integración
- `routes/orders.js`: Envía notificaciones al crear pedidos
- `routes/dashboard.js`: Envía notificaciones al cambiar estado de pedidos

## Estructura de la Base de Datos

```sql
CREATE TABLE push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo_usuario ENUM('cliente', 'restaurante', 'admin') NOT NULL,
    subscription_data JSON NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
```

## Tipos de Notificaciones

### Nuevo Pedido (Restaurante)
- **Título**: "¡Nuevo Pedido!"
- **Cuerpo**: "Pedido #ALM-1234567890 - $1500.00"
- **Acciones**: "Ver Pedido", "Cerrar"

### Cambio de Estado (Cliente)
- **Título**: "Estado del Pedido Actualizado"
- **Cuerpo**: "Tu pedido ha sido confirmado - Pedido #ALM-1234567890"
- **Acciones**: "Ver Pedido", "Cerrar"

## Estados de Pedido que Generan Notificaciones

- `confirmado`: "Tu pedido ha sido confirmado"
- `preparando`: "Tu pedido está siendo preparado"
- `listo`: "Tu pedido está listo para entrega"
- `en_camino`: "Tu pedido está en camino"
- `entregado`: "Tu pedido ha sido entregado"

## Solución de Problemas

### Las notificaciones no aparecen
1. Verificar que el navegador soporte notificaciones push
2. Verificar que se hayan otorgado permisos
3. Revisar la consola del navegador para errores
4. Verificar que el Service Worker esté registrado

### Error "Subscription not found"
- La suscripción puede haber expirado
- El sistema elimina automáticamente suscripciones inválidas
- Habilitar nuevamente las notificaciones

### Error de permisos
- Ir a Configuración del navegador > Privacidad y seguridad > Notificaciones
- Permitir notificaciones para el sitio web

## Compatibilidad

- ✅ Chrome 42+
- ✅ Firefox 44+
- ✅ Safari 16+
- ✅ Edge 17+

## Seguridad

- Las claves VAPID se generan automáticamente y se almacenan localmente
- Las suscripciones están vinculadas a usuarios autenticados
- Se eliminan automáticamente las suscripciones inválidas
- Las notificaciones solo se envían a usuarios autorizados

## Rendimiento

- Las notificaciones se envían de forma asíncrona
- No bloquean la creación o actualización de pedidos
- Se manejan errores de forma elegante
- Las suscripciones se limpian automáticamente 