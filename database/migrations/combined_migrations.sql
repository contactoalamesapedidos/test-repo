-- Eliminar triggers automáticos de reseñas/calificaciones al entregar un pedido
DROP TRIGGER IF EXISTS after_pedido_entregado;
DROP TRIGGER IF EXISTS calificacion_auto;
DROP TRIGGER IF EXISTS insert_calificacion_on_entregado;
DROP TRIGGER IF EXISTS trigger_crear_calificacion;
-- Si el trigger tiene otro nombre, cámbialo aquí según corresponda 

-- Agregar campo 'visible' a la tabla productos
ALTER TABLE productos ADD COLUMN visible BOOLEAN NOT NULL DEFAULT TRUE; ALTER TABLE pedidos
ADD COLUMN fecha_preparando TIMESTAMP NULL AFTER fecha_confirmacion,
ADD COLUMN fecha_en_camino TIMESTAMP NULL AFTER fecha_preparando,
DROP COLUMN fecha_listo;ALTER TABLE restaurantes
ADD COLUMN mp_access_token VARCHAR(255) NULL,
ADD COLUMN mp_refresh_token VARCHAR(255) NULL,
ADD COLUMN mp_user_id VARCHAR(100) NULL;ALTER TABLE restaurantes ADD COLUMN mp_public_key VARCHAR(255) NULL;
ALTER TABLE usuarios ADD COLUMN rol VARCHAR(255) NOT NULL DEFAULT 'cliente';CREATE TABLE IF NOT EXISTS migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);-- Migración para añadir la tabla `drivers` y modificar la tabla `pedidos` para el sistema de repartidores.

-- Tabla de repartidores
CREATE TABLE drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    restaurante_id INT NULL COMMENT 'ID del restaurante si es un repartidor propio, NULL para repartidores privados',
    status ENUM('available', 'on_delivery', 'offline') NOT NULL DEFAULT 'offline',
    current_latitude DECIMAL(10, 8) NULL,
    current_longitude DECIMAL(11, 8) NULL,
    vehicle_type VARCHAR(50) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_restaurante (restaurante_id)
);

-- Modificar la tabla `pedidos`
ALTER TABLE pedidos
    ADD COLUMN delivery_status ENUM('pending_assignment', 'assigned', 'picked_up', 'on_the_way', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending_assignment' AFTER estado,
    ADD COLUMN pickup_latitude DECIMAL(10, 8) NULL AFTER latitud_entrega,
    ADD COLUMN pickup_longitude DECIMAL(11, 8) NULL AFTER pickup_latitude,
    ADD COLUMN assigned_at TIMESTAMP NULL AFTER fecha_pedido,
    ADD COLUMN picked_up_at TIMESTAMP NULL AFTER assigned_at,
    ADD COLUMN delivered_at TIMESTAMP NULL AFTER picked_up_at;

-- Añadir índices para las nuevas columnas en `pedidos`
ALTER TABLE pedidos
    ADD INDEX idx_delivery_status (delivery_status),
    ADD INDEX idx_assigned_at (assigned_at),
    ADD INDEX idx_picked_up_at (picked_up_at),
    ADD INDEX idx_delivered_at (delivered_at);
ALTER TABLE pedidos MODIFY COLUMN estado VARCHAR(20) NOT NULL DEFAULT 'pendiente';ALTER TABLE pedidos MODIFY COLUMN estado ENUM('pendiente', 'pagado', 'pendiente_pago', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado') NOT NULL DEFAULT 'pendiente';CREATE TABLE mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    remitente_id INT NOT NULL,
    destinatario_id INT NOT NULL,
    mensaje TEXT NOT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tipo_remitente VARCHAR(50) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (remitente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (destinatario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);ALTER TABLE pedidos
ADD COLUMN estado_pago VARCHAR(50) NULL,
ADD COLUMN mp_payment_id VARCHAR(255) NULL,
ADD COLUMN mp_status VARCHAR(50) NULL,
ADD COLUMN mp_status_detail VARCHAR(255) NULL,
ADD COLUMN fecha_pago TIMESTAMP NULL;ALTER TABLE pedidos
ADD COLUMN mp_payment_id VARCHAR(255) NULL,
ADD COLUMN mp_status VARCHAR(50) NULL,
ADD COLUMN mp_status_detail VARCHAR(255) NULL,
ADD COLUMN fecha_pago TIMESTAMP NULL;ALTER TABLE pedidos MODIFY COLUMN estado ENUM('pendiente', 'pagado', 'pendiente_pago', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'pago_cancelado') DEFAULT 'pendiente';ALTER TABLE usuarios ADD COLUMN recibir_notificaciones BOOLEAN DEFAULT TRUE;-- Agrega preferencias de notificación por email para usuarios y restaurantes

-- Preferencias para usuarios (clientes y otros tipos)
ALTER TABLE usuarios 
    ADD COLUMN email_notif_nuevo_pedido BOOLEAN DEFAULT TRUE,
    ADD COLUMN email_notif_cambio_estado BOOLEAN DEFAULT TRUE;

-- Preferencias para restaurantes
ALTER TABLE restaurantes 
    ADD COLUMN email_notif_nuevo_pedido BOOLEAN DEFAULT TRUE,
    ADD COLUMN email_notif_cambio_estado BOOLEAN DEFAULT TRUE;
ALTER TABLE pedidos
ADD COLUMN driver_payout_amount DECIMAL(10, 2) DEFAULT NULL;ALTER TABLE drivers
ADD COLUMN restaurante_id INT NULL,
ADD COLUMN request_status ENUM('independent', 'pending', 'accepted', 'rejected') DEFAULT 'independent';

ALTER TABLE drivers
ADD CONSTRAINT fk_drivers_restaurante_id
FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id)
ON DELETE SET NULL;
-- Tabla para almacenar la información de los repartidores
CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    restaurante_id INT NULL,
    vehicle_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'offline',
    request_status VARCHAR(20) DEFAULT 'pending',
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_lat DECIMAL(10, 8),
    last_lng DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE SET NULL
);

-- Tabla para que los repartidores definan su disponibilidad
CREATE TABLE IF NOT EXISTS horarios_trabajo_repartidor (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repartidor_id INT NOT NULL,
    dia_semana INT NOT NULL, -- 0 para Domingo, 1 para Lunes, etc.
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    FOREIGN KEY (repartidor_id) REFERENCES drivers(id) ON DELETE CASCADE
);

-- Tabla para registrar las comisiones por cada entrega
CREATE TABLE IF NOT EXISTS comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repartidor_id INT NOT NULL,
    pedido_id INT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    estado ENUM('pendiente', 'pagada') NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP NULL,
    FOREIGN KEY (repartidor_id) REFERENCES drivers(id) ON DELETE CASCADE,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
);

-- Modificar la tabla de pedidos para asociar un repartidor y guardar la ubicación del cliente
ALTER TABLE pedidos
ADD COLUMN repartidor_id INT NULL,
ADD COLUMN cliente_lat DECIMAL(10, 8) NULL,
ADD COLUMN cliente_lng DECIMAL(11, 8) NULL,
ADD CONSTRAINT fk_pedidos_repartidor FOREIGN KEY (repartidor_id) REFERENCES drivers(id) ON DELETE SET NULL;-- Agregar columnas faltantes a la tabla drivers
-- Este archivo corrige el error "Unknown column 'd.last_lat' in 'field list'"

-- Verificar si las columnas ya existen antes de agregarlas
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'drivers'
    AND COLUMN_NAME = 'last_lat'
);

-- Agregar last_lat si no existe
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE drivers ADD COLUMN last_lat DECIMAL(10, 8) NULL',
    'SELECT "Column last_lat already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar last_lng
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'drivers'
    AND COLUMN_NAME = 'last_lng'
);

-- Agregar last_lng si no existe
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE drivers ADD COLUMN last_lng DECIMAL(11, 8) NULL',
    'SELECT "Column last_lng already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar current_latitude
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'drivers'
    AND COLUMN_NAME = 'current_latitude'
);

-- Agregar current_latitude si no existe
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE drivers ADD COLUMN current_latitude DECIMAL(10, 8) NULL',
    'SELECT "Column current_latitude already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verificar current_longitude
SET @column_exists = (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'drivers'
    AND COLUMN_NAME = 'current_longitude'
);

-- Agregar current_longitude si no existe
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE drivers ADD COLUMN current_longitude DECIMAL(11, 8) NULL',
    'SELECT "Column current_longitude already exists" as message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
INSERT INTO categorias_restaurantes (nombre, descripcion, imagen, activa, orden_display) VALUES ('Panadería', 'Pan fresco, pasteles y más.', '/images/categories/panaderia.png', 1, 5);
ALTER TABLE restaurantes ADD COLUMN ofrece_descuento_efectivo BOOLEAN DEFAULT FALSE;ALTER TABLE restaurantes ADD COLUMN latitud DECIMAL(10, 8) NULL, ADD COLUMN longitud DECIMAL(11, 8) NULL;ALTER TABLE restaurantes ADD COLUMN longitud DECIMAL(11, 8) NULL;-- Add missing product categories
INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Postres', 'Deliciosos postres y dulces', 50, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Postres' AND restaurante_id IS NULL);

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Panadería', 'Pan fresco y productos de panadería', 60, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Panadería' AND restaurante_id IS NULL);

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Bebidas', 'Refrescos, jugos y bebidas', 70, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Bebidas' AND restaurante_id IS NULL);

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Pastas', 'Variedad de pastas y salsas', 80, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Pastas' AND restaurante_id IS NULL);
CREATE TABLE IF NOT EXISTS pagos_comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repartidor_id INT NOT NULL,
    monto_total DECIMAL(10, 2) NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
    comprobante_pago VARCHAR(255) DEFAULT NULL,
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_revision TIMESTAMP NULL DEFAULT NULL,
    admin_revisor_id INT DEFAULT NULL,
    comentarios_admin TEXT,
    FOREIGN KEY (repartidor_id) REFERENCES drivers(id),
    FOREIGN KEY (admin_revisor_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;