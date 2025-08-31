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
