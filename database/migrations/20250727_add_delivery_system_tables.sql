-- Migración para añadir la tabla `drivers` y modificar la tabla `pedidos` para el sistema de repartidores.

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
