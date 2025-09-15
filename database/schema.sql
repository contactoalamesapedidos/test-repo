-- Crear base de datos A la Mesa
CREATE DATABASE IF NOT EXISTS a_la_mesa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE a_la_mesa;

-- Tabla de usuarios (clientes, restaurantes, administradores, repartidores)
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    ciudad VARCHAR(100) NOT NULL,
    tipo_usuario ENUM('cliente', 'restaurante', 'admin', 'repartidor') NOT NULL DEFAULT 'cliente',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo BOOLEAN DEFAULT TRUE,
    imagen_perfil VARCHAR(255),
    fecha_nacimiento DATE,
    INDEX idx_email (email),
    INDEX idx_tipo_usuario (tipo_usuario),
    INDEX idx_ciudad (ciudad)
);

-- Tabla de direcciones
CREATE TABLE IF NOT EXISTS direcciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL COMMENT 'Casa, Trabajo, etc.',
    direccion TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(10),
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    es_principal BOOLEAN DEFAULT FALSE,
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id)
);

-- Tabla de categorías de restaurantes
CREATE TABLE IF NOT EXISTS categorias_restaurantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    imagen VARCHAR(255),
    activa BOOLEAN DEFAULT TRUE,
    orden_display INT DEFAULT 0
);

-- Tabla de restaurantes
CREATE TABLE IF NOT EXISTS restaurantes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    imagen_logo VARCHAR(255),
    imagen_banner VARCHAR(255),
    direccion TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    email_contacto VARCHAR(150),
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    horario_apertura TIME,
    horario_cierre TIME,
        dias_operacion TEXT,
    tiempo_entrega_min INT DEFAULT 30 COMMENT 'Tiempo mínimo en minutos',
    tiempo_entrega_max INT DEFAULT 60 COMMENT 'Tiempo máximo en minutos',
    costo_delivery DECIMAL(8,2) DEFAULT 0.00,
    pedido_minimo DECIMAL(8,2) DEFAULT 0.00,
    calificacion_promedio DECIMAL(2,1) DEFAULT 0.0,
    total_calificaciones INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    verificado BOOLEAN DEFAULT FALSE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mp_access_token VARCHAR(255) NULL,
    mp_refresh_token VARCHAR(255) NULL,
    mp_user_id VARCHAR(100) NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_ciudad (ciudad),
    INDEX idx_activo (activo),
    INDEX idx_calificacion (calificacion_promedio)
);

-- Tabla de relación restaurante-categoría
CREATE TABLE IF NOT EXISTS restaurante_categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id INT NOT NULL,
    categoria_id INT NOT NULL,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias_restaurantes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_restaurante_categoria (restaurante_id, categoria_id)
);

-- Tabla de categorías de productos
CREATE TABLE IF NOT EXISTS categorias_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    orden_display INT DEFAULT 0,
    activa BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    INDEX idx_restaurante (restaurante_id)
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id INT NOT NULL,
    categoria_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(8,2) NOT NULL,
    imagen VARCHAR(255),
    ingredientes TEXT,
    calorias INT,
    tiempo_preparacion INT COMMENT 'Tiempo en minutos',
    disponible BOOLEAN DEFAULT TRUE,
    destacado BOOLEAN DEFAULT FALSE,
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT NULL,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    FOREIGN KEY (categoria_id) REFERENCES categorias_productos(id) ON DELETE CASCADE,
    INDEX idx_restaurante (restaurante_id),
    INDEX idx_categoria (categoria_id),
    INDEX idx_disponible (disponible),
    INDEX idx_destacado (destacado)
);

-- Tabla de opciones de productos (ej: tamaño, extras)
CREATE TABLE IF NOT EXISTS opciones_productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    producto_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL COMMENT 'Tamaño, Extras, etc.',
    tipo ENUM('radio', 'checkbox') DEFAULT 'radio',
    requerido BOOLEAN DEFAULT FALSE,
    orden_display INT DEFAULT 0,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    INDEX idx_producto (producto_id)
);

-- Tabla de valores de opciones
CREATE TABLE IF NOT EXISTS valores_opciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    opcion_id INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    precio_adicional DECIMAL(8,2) DEFAULT 0.00,
    disponible BOOLEAN DEFAULT TRUE,
    orden_display INT DEFAULT 0,
    FOREIGN KEY (opcion_id) REFERENCES opciones_productos(id) ON DELETE CASCADE,
    INDEX idx_opcion (opcion_id)
);

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_pedido VARCHAR(20) UNIQUE NOT NULL,
    cliente_id INT NOT NULL,
    restaurante_id INT NOT NULL,
    repartidor_id INT NULL,
    direccion_entrega TEXT NOT NULL,
    latitud_entrega DECIMAL(10, 8),
    longitud_entrega DECIMAL(11, 8),
    subtotal DECIMAL(8,2) NOT NULL,
    costo_delivery DECIMAL(8,2) NOT NULL,
    impuestos DECIMAL(8,2) DEFAULT 0.00,
    descuento DECIMAL(8,2) DEFAULT 0.00,
    total DECIMAL(8,2) NOT NULL,
    estado ENUM('pendiente', 'pagado', 'pendiente_pago', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado') DEFAULT 'pendiente',
    metodo_pago ENUM('efectivo', 'tarjeta', 'transferencia', 'mercadopago') NOT NULL,
    notas_especiales TEXT,
    tiempo_estimado INT COMMENT 'Tiempo estimado en minutos',
    fecha_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_confirmacion TIMESTAMP NULL,
    fecha_listo TIMESTAMP NULL,
    fecha_entrega TIMESTAMP NULL,
    motivo_cancelacion TEXT,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
    FOREIGN KEY (repartidor_id) REFERENCES usuarios(id),
    INDEX idx_cliente (cliente_id),
    INDEX idx_restaurante (restaurante_id),
    INDEX idx_repartidor (repartidor_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha_pedido (fecha_pedido)
);

-- Tabla de items del pedido
CREATE TABLE IF NOT EXISTS items_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(8,2) NOT NULL,
    subtotal DECIMAL(8,2) NOT NULL,
    notas_especiales TEXT,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id),
    INDEX idx_pedido (pedido_id),
    INDEX idx_producto (producto_id)
);

-- Tabla de opciones seleccionadas en items
CREATE TABLE IF NOT EXISTS item_opciones_seleccionadas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_pedido_id INT NOT NULL,
    valor_opcion_id INT NOT NULL,
    precio_adicional DECIMAL(8,2) NOT NULL,
    FOREIGN KEY (item_pedido_id) REFERENCES items_pedido(id) ON DELETE CASCADE,
    FOREIGN KEY (valor_opcion_id) REFERENCES valores_opciones(id),
    INDEX idx_item_pedido (item_pedido_id)
);

-- Tabla de calificaciones y reseñas
CREATE TABLE IF NOT EXISTS calificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    cliente_id INT NOT NULL,
    restaurante_id INT NOT NULL,
    repartidor_id INT NULL,
    calificacion_restaurante INT CHECK (calificacion_restaurante >= 1 AND calificacion_restaurante <= 5),
    calificacion_repartidor INT CHECK (calificacion_repartidor >= 1 AND calificacion_repartidor <= 5),
    comentario_restaurante TEXT,
    comentario_repartidor TEXT,
    fecha_calificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
    FOREIGN KEY (repartidor_id) REFERENCES usuarios(id),
    UNIQUE KEY unique_calificacion_pedido (pedido_id),
    INDEX idx_restaurante (restaurante_id),
    INDEX idx_repartidor (repartidor_id)
);

-- Tabla de carrito de compras
CREATE TABLE IF NOT EXISTS carrito (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    notas_especiales TEXT,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT NULL,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cliente_producto (cliente_id, producto_id),
    INDEX idx_cliente (cliente_id)
);

-- Tabla de opciones seleccionadas en carrito
CREATE TABLE IF NOT EXISTS carrito_opciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    carrito_id INT NOT NULL,
    valor_opcion_id INT NOT NULL,
    FOREIGN KEY (carrito_id) REFERENCES carrito(id) ON DELETE CASCADE,
    FOREIGN KEY (valor_opcion_id) REFERENCES valores_opciones(id) ON DELETE CASCADE,
    UNIQUE KEY unique_carrito_opcion (carrito_id, valor_opcion_id),
    INDEX idx_carrito (carrito_id)
);

-- Tabla de cupones de descuento
CREATE TABLE IF NOT EXISTS cupones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT,
    tipo ENUM('porcentaje', 'monto_fijo') NOT NULL,
    valor DECIMAL(8,2) NOT NULL,
    pedido_minimo DECIMAL(8,2) DEFAULT 0.00,
    limite_uso INT DEFAULT NULL COMMENT 'NULL = ilimitado',
    usos_actuales INT DEFAULT 0,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    aplicable_a ENUM('todos', 'restaurante_especifico') DEFAULT 'todos',
    restaurante_id INT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id),
    INDEX idx_codigo (codigo),
    INDEX idx_fechas (fecha_inicio, fecha_fin)
);

-- Tabla de uso de cupones
CREATE TABLE IF NOT EXISTS uso_cupones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cupon_id INT NOT NULL,
    pedido_id INT NOT NULL,
    cliente_id INT NOT NULL,
    descuento_aplicado DECIMAL(8,2) NOT NULL,
    fecha_uso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cupon_id) REFERENCES cupones(id),
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    UNIQUE KEY unique_cupon_pedido (cupon_id, pedido_id),
    INDEX idx_cliente (cliente_id)
);

-- Tabla de favoritos
CREATE TABLE IF NOT EXISTS favoritos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    restaurante_id INT NOT NULL,
    fecha_agregado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_cliente_restaurante (cliente_id, restaurante_id),
    INDEX idx_cliente (cliente_id)
);

-- Tabla de configuraciones del sistema
CREATE TABLE IF NOT EXISTS configuraciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descripcion TEXT,
    tipo ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de cobros semanales (10% de ventas brutas)
CREATE TABLE IF NOT EXISTS cobros_semanales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id INT NOT NULL,
    semana_inicio DATE NOT NULL,
    semana_fin DATE NOT NULL,
    ventas_brutas DECIMAL(12,2) DEFAULT 0.00,
    porcentaje_comision DECIMAL(5,2) DEFAULT 10.00,
    monto_comision DECIMAL(12,2) DEFAULT 0.00,
    estado ENUM('pendiente', 'pagado', 'vencido', 'exonerado') DEFAULT 'pendiente',
    fecha_vencimiento DATE NOT NULL,
    fecha_pago TIMESTAMP NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizacion DATETIME DEFAULT NULL,
    notas TEXT,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_restaurante_semana (restaurante_id, semana_inicio),
    INDEX idx_estado (estado),
    INDEX idx_fechas (semana_inicio, semana_fin),
    INDEX idx_vencimiento (fecha_vencimiento)
);

-- Tabla de comprobantes de pago
CREATE TABLE IF NOT EXISTS comprobantes_pago (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cobro_semanal_id INT NOT NULL,
    restaurante_id INT NOT NULL,
    archivo_comprobante VARCHAR(500) NOT NULL,
    metodo_pago ENUM('transferencia', 'deposito', 'mercadopago', 'efectivo', 'otro') NOT NULL,
    referencia_pago VARCHAR(200),
    monto_pagado DECIMAL(12,2) NOT NULL,
    fecha_pago_declarada DATE NOT NULL,
    estado ENUM('pendiente', 'aprobado', 'rechazado') DEFAULT 'pendiente',
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_revision TIMESTAMP NULL,
    admin_revisor_id INT NULL,
    comentarios_admin TEXT,
    comentarios_restaurante TEXT,
    FOREIGN KEY (cobro_semanal_id) REFERENCES cobros_semanales(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_revisor_id) REFERENCES usuarios(id),
    INDEX idx_estado (estado),
    INDEX idx_restaurante (restaurante_id),
    INDEX idx_fecha_subida (fecha_subida)
);

-- Tabla de ventas diarias (para calcular comisiones)
CREATE TABLE IF NOT EXISTS ventas_diarias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    restaurante_id INT NOT NULL,
    fecha DATE NOT NULL,
    cantidad_pedidos INT DEFAULT 0,
    monto_ventas DECIMAL(12,2) DEFAULT 0.00,
    monto_comisiones DECIMAL(12,2) DEFAULT 0.00,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE CASCADE,
    UNIQUE KEY unique_restaurante_fecha (restaurante_id, fecha),
    INDEX idx_fecha (fecha),
    INDEX idx_restaurante (restaurante_id)
);

-- Tabla de actividad de administradores
CREATE TABLE IF NOT EXISTS actividad_admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    accion ENUM('crear_restaurante', 'eliminar_restaurante', 'editar_restaurante', 
                'aprobar_pago', 'rechazar_pago', 'crear_producto', 'eliminar_producto', 
                'editar_producto', 'generar_cobro', 'otro') NOT NULL,
    descripcion TEXT NOT NULL,
    entidad_tipo ENUM('restaurante', 'producto', 'cobro', 'comprobante', 'usuario') NULL,
    entidad_id INT NULL,
        datos_anteriores TEXT NULL,
        datos_nuevos TEXT NULL,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    FOREIGN KEY (admin_id) REFERENCES usuarios(id),
    INDEX idx_admin (admin_id),
    INDEX idx_fecha (fecha_accion),
    INDEX idx_accion (accion)
);

-- Tabla de notificaciones del sistema
CREATE TABLE IF NOT EXISTS notificaciones_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo ENUM('cobro_pendiente', 'pago_aprobado', 'pago_rechazado', 'vencimiento_proximo',
              'nuevo_cobro', 'producto_agregado', 'producto_eliminado', 'otro') NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    mensaje TEXT NOT NULL,
    leida BOOLEAN DEFAULT FALSE,
    url_accion VARCHAR(500) NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_leida TIMESTAMP NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario (usuario_id),
    INDEX idx_leida (leida),
    INDEX idx_fecha (fecha_creacion)
);

-- Tabla de sesiones para express-mysql-session
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de logs de seguridad
CREATE TABLE IF NOT EXISTS security_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    level ENUM('info', 'warning', 'error') NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    user_id INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    details JSON NULL,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_level (level),
    INDEX idx_event_type (event_type),
    INDEX idx_user (user_id),
    INDEX idx_ip (ip_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de tokens CSRF
CREATE TABLE IF NOT EXISTS csrf_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(128) UNIQUE NOT NULL,
    user_id INT NULL,
    session_id VARCHAR(128) NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token (token),
    INDEX idx_user (user_id),
    INDEX idx_session (session_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    hits INT DEFAULT 1,
    reset_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_identifier_endpoint (identifier, endpoint),
    INDEX idx_reset_time (reset_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(128) UNIQUE NOT NULL,
    permissions JSON NOT NULL,
    last_used TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_key_hash (key_hash),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de datos encriptados sensibles
CREATE TABLE IF NOT EXISTS encrypted_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    data_type ENUM('payment_info', 'personal_info', 'api_credentials', 'other') NOT NULL,
    encrypted_data TEXT NOT NULL,
    salt VARCHAR(64) NOT NULL,
    iv VARCHAR(64) NOT NULL,
    tag VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_user_type (user_id, data_type),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de mensajes del pedido (chat)
CREATE TABLE IF NOT EXISTS mensajes_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    remitente_tipo ENUM('cliente', 'restaurante', 'admin') NOT NULL,
    remitente_id INT NOT NULL,
    mensaje TEXT NOT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pedido (pedido_id),
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de drivers (repartidores) - actualizada
CREATE TABLE IF NOT EXISTS drivers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    restaurante_id INT NULL COMMENT 'ID del restaurante si es un repartidor propio, NULL para repartidores privados',
    status ENUM('available', 'on_delivery', 'offline') NOT NULL DEFAULT 'offline',
    current_latitude DECIMAL(10, 8) NULL,
    current_longitude DECIMAL(11, 8) NULL,
    vehicle_type VARCHAR(50) NULL,
    request_status ENUM('independent', 'pending', 'accepted', 'rejected') DEFAULT 'independent',
    last_lat DECIMAL(10, 8) NULL,
    last_lng DECIMAL(11, 8) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurante_id) REFERENCES restaurantes(id) ON DELETE SET NULL,
    INDEX idx_status (status),
    INDEX idx_restaurante (restaurante_id),
    INDEX idx_request_status (request_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de horarios de trabajo de repartidores
CREATE TABLE IF NOT EXISTS horarios_trabajo_repartidor (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repartidor_id INT NOT NULL,
    dia_semana INT NOT NULL, -- 0 para Domingo, 1 para Lunes, etc.
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    FOREIGN KEY (repartidor_id) REFERENCES drivers(id) ON DELETE CASCADE,
    INDEX idx_repartidor (repartidor_id),
    INDEX idx_dia (dia_semana)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de comisiones de repartidores
CREATE TABLE IF NOT EXISTS comisiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repartidor_id INT NOT NULL,
    pedido_id INT NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    estado ENUM('pendiente', 'pagada') NOT NULL DEFAULT 'pendiente',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_pago TIMESTAMP NULL,
    FOREIGN KEY (repartidor_id) REFERENCES drivers(id) ON DELETE CASCADE,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    INDEX idx_repartidor (repartidor_id),
    INDEX idx_pedido (pedido_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de pagos de comisiones
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
    FOREIGN KEY (admin_revisor_id) REFERENCES usuarios(id),
    INDEX idx_repartidor (repartidor_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha_solicitud (fecha_solicitud)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de push subscriptions para notificaciones
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo_usuario ENUM('cliente', 'restaurante', 'admin', 'repartidor') NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_usuario_tipo (usuario_id, tipo_usuario),
    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de actividad de administradores (actualizada)
CREATE TABLE IF NOT EXISTS actividad_admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    accion ENUM('crear_restaurante', 'eliminar_restaurante', 'editar_restaurante',
                'aprobar_pago', 'rechazar_pago', 'crear_producto', 'eliminar_producto',
                'editar_producto', 'generar_cobro', 'otro') NOT NULL,
    descripcion TEXT NOT NULL,
    entidad_tipo ENUM('restaurante', 'producto', 'cobro', 'comprobante', 'usuario') NULL,
    entidad_id INT NULL,
    datos_anteriores TEXT NULL,
    datos_nuevos TEXT NULL,
    ip_address VARCHAR(45) NULL,
    fecha_accion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES usuarios(id),
    INDEX idx_admin (admin_id),
    INDEX idx_fecha (fecha_accion),
    INDEX idx_accion (accion),
    INDEX idx_entidad (entidad_tipo, entidad_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de tokens de reseteo de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(128) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de intentos de login fallidos
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_ip (ip_address),
    INDEX idx_attempted (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de configuraciones de seguridad
CREATE TABLE IF NOT EXISTS security_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insertar configuraciones de seguridad por defecto
INSERT IGNORE INTO security_config (config_key, config_value, description) VALUES
('max_login_attempts', '5', 'Máximo número de intentos de login fallidos'),
('lockout_duration', '900', 'Duración del bloqueo en segundos (15 minutos)'),
('password_min_length', '8', 'Longitud mínima de contraseña'),
('session_timeout', '86400', 'Tiempo de expiración de sesión en segundos (24 horas)'),
('csrf_token_expiry', '3600', 'Tiempo de expiración de token CSRF en segundos (1 hora)'),
('rate_limit_window', '900', 'Ventana de rate limiting en segundos (15 minutos)'),
('rate_limit_max_requests', '100', 'Máximo número de requests por ventana'),
('enable_security_logging', 'true', 'Habilitar logging de seguridad'),
('enable_ip_blocking', 'true', 'Habilitar bloqueo por IP'),
('enable_suspicious_activity_detection', 'true', 'Habilitar detección de actividad sospechosa');
