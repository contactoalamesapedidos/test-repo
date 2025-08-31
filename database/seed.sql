-- Datos de ejemplo para A la Mesa
USE a_la_mesa;

-- Deshabilitar la verificación de claves foráneas temporalmente
SET FOREIGN_KEY_CHECKS = 0;

-- Limpiar tablas relacionadas con pedidos, productos, y categorías
-- IMPORTANTE: Esto eliminará TODOS los datos de estas tablas. ¡Haz un respaldo si es necesario!
DELETE FROM valores_opciones;
DELETE FROM opciones_productos;
DELETE FROM items_pedido;
DELETE FROM calificaciones;
DELETE FROM pedidos;
DELETE FROM productos;
DELETE FROM categorias_productos;
DELETE FROM restaurante_categorias;
DELETE FROM restaurantes;
DELETE FROM cupones;
DELETE FROM configuraciones;
DELETE FROM ventas_diarias;
DELETE FROM favoritos;
DELETE FROM direcciones;
DELETE FROM usuarios;

-- Restablecer el AUTO_INCREMENT para las tablas
ALTER TABLE usuarios AUTO_INCREMENT = 1;
ALTER TABLE direcciones AUTO_INCREMENT = 1;
ALTER TABLE categorias_restaurantes AUTO_INCREMENT = 1;
ALTER TABLE restaurantes AUTO_INCREMENT = 1;
ALTER TABLE categorias_productos AUTO_INCREMENT = 1;
ALTER TABLE productos AUTO_INCREMENT = 1;
ALTER TABLE opciones_productos AUTO_INCREMENT = 1;
ALTER TABLE valores_opciones AUTO_INCREMENT = 1;
ALTER TABLE cupones AUTO_INCREMENT = 1;
ALTER TABLE configuraciones AUTO_INCREMENT = 1;
ALTER TABLE pedidos AUTO_INCREMENT = 1;
ALTER TABLE items_pedido AUTO_INCREMENT = 1;
ALTER TABLE calificaciones AUTO_INCREMENT = 1;
ALTER TABLE favoritos AUTO_INCREMENT = 1;
ALTER TABLE ventas_diarias AUTO_INCREMENT = 1;


-- Insertar usuarios de ejemplo (password para todos: "123456")
INSERT INTO usuarios (nombre, apellido, email, password, telefono, tipo_usuario, imagen_perfil, ciudad) VALUES
('Administrador', 'Sistema', 'admin@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567890', 'admin', 'admin.jpg', 'Buenos Aires'),
('Juan', 'Pérez', 'demo@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567891', 'cliente', 'user1.jpg', 'Buenos Aires'),
('María', 'González', 'maria@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567892', 'cliente', 'user2.jpg', 'Buenos Aires'),
('Restaurante', 'La Empanada', 'restaurante1@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567893', 'restaurante', 'rest1.jpg', 'Buenos Aires'),
('Pizzería', 'Master', 'restaurante2@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567894', 'restaurante', 'rest2.jpg', 'Buenos Aires'),
('Sandwicheria', 'Express', 'restaurante3@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567895', 'restaurante', 'rest3.jpg', 'Buenos Aires'),
('La', 'Nonna', 'restaurante4@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567896', 'restaurante', 'rest4.jpg', 'Buenos Aires'),
('El', 'Rincon', 'restaurante5@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567897', 'restaurante', 'rest5.jpg', 'Buenos Aires'),
('Carlos', 'Repartidor', 'carlos.repartidor@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567898', 'repartidor', 'delivery1.jpg', 'Buenos Aires'),
('Ana', 'Delivery', 'ana.delivery@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567899', 'repartidor', 'delivery2.jpg', 'Buenos Aires');


-- Insertar direcciones de ejemplo
INSERT INTO direcciones (usuario_id, nombre, direccion, ciudad, latitud, longitud, es_principal) VALUES
(2, 'Casa', 'Av. Libertador 1234, Apartamento 5B', 'Buenos Aires', -34.603722, -58.381592, TRUE),
(3, 'Trabajo', 'Av. Corrientes 5678', 'Buenos Aires', -34.603945, -58.381234, FALSE),
(3, 'Casa', 'Calle Florida 9876', 'Buenos Aires', -34.604722, -58.382592, TRUE);

-- Insertar categorías de restaurantes
INSERT INTO categorias_restaurantes (nombre, descripcion, imagen, orden_display) VALUES
('Empanadas', 'Las mejores empanadas de la ciudad', 'empanadas.jpg', 1),
('Pizzas', 'Variedad de pizzas para todos los gustos', 'pizza.jpg', 2),
('Sandwiches', 'Deliciosos sandwiches y wraps', 'sandwich.jpg', 3),
('Pastas', 'Pastas frescas y salsas caseras', 'pastas.jpg', 4),
('Otros', 'Todo tipo de comidas variadas', 'others.jpg', 5);

-- Insertar restaurantes
INSERT INTO restaurantes (usuario_id, nombre, descripcion, imagen_logo, imagen_banner, direccion, ciudad, telefono, email_contacto, latitud, longitud, horario_apertura, horario_cierre, dias_operacion, tiempo_entrega_min, tiempo_entrega_max, costo_delivery, pedido_minimo, calificacion_promedio, total_calificaciones, verificado) VALUES
(4, 'La Casa de la Empanada', 'Las empanadas más ricas y variadas', 'empanada-logo.jpg', 'empanada-banner.jpg', 'Calle Falsa 123', 'Buenos Aires', '+5411-1234-5678', 'contacto@empanadas.com', -34.603722, -58.381592, '11:00:00', '23:00:00', '[1,2,3,4,5,6,7]', 30, 45, 3.00, 10.00, 4.8, 100, TRUE),
(5, 'Pizza Master', 'Pizzas artesanales con el mejor sabor', 'pizzamaster-logo.jpg', 'pizzamaster-banner.jpg', 'Av. Siempre Viva 742', 'Buenos Aires', '+5411-8765-4321', 'info@pizzamaster.com', -34.604945, -58.382234, '18:00:00', '00:00:00', '[1,2,3,4,5,6,7]', 20, 35, 2.50, 15.00, 4.6, 120, TRUE),
(6, 'Sandwicheria Express', 'Los sandwiches más rápidos y deliciosos', 'sandwich-logo.jpg', 'sandwich-banner.jpg', 'Rivadavia 456', 'Buenos Aires', '+5411-9876-5432', 'contacto@sandwichexpress.com', -34.605722, -58.383592, '10:00:00', '20:00:00', '[2,3,4,5,6]', 25, 40, 2.00, 8.00, 4.5, 90, TRUE),
(7, 'La Nonna Trattoria', 'Auténtica cocina italiana con pastas caseras', 'lanonna-logo.jpg', 'lanonna-banner.jpg', 'Av. Italia 100', 'Buenos Aires', '+5411-1111-2222', 'contacto@lanonna.com', -34.600000, -58.390000, '12:00:00', '23:00:00', '[1,2,3,4,5,6,7]', 30, 45, 4.00, 20.00, 4.7, 75, TRUE),
(8, 'El Rincón del Sabor', 'Variedad de platos caseros e internacionales', 'elrincon-logo.jpg', 'elrincon-banner.jpg', 'Calle Principal 500', 'Buenos Aires', '+5411-3333-4444', 'contacto@elrincon.com', -34.610000, -58.400000, '09:00:00', '21:00:00', '[1,2,3,4,5,6,7]', 35, 50, 5.00, 12.00, 4.4, 60, TRUE);


-- Insertar relación restaurante-categorías
INSERT INTO restaurante_categorias (restaurante_id, categoria_id) VALUES
(1, 1), -- La Casa de la Empanada -> Empanadas
(2, 2), -- Pizza Master -> Pizzas
(3, 3), -- Sandwicheria Express -> Sandwiches
(4, 4), -- La Nonna Trattoria -> Pastas
(5, 5); -- El Rincón del Sabor -> Otros

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Pizzas', 'Variedad de pizzas para todos los gustos', 10, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Pizzas' AND restaurante_id IS NULL);

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Empanadas', 'Las mejores empanadas de la ciudad', 20, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Empanadas' AND restaurante_id IS NULL);

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Sandwiches', 'Deliciosos sandwiches y wraps', 30, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Sandwiches' AND restaurante_id IS NULL);

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT NULL, 'Otros', 'Todo tipo de comidas variadas', 40, 1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM categorias_productos WHERE nombre = 'Otros' AND restaurante_id IS NULL);

-- Insertar productos
INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, imagen, ingredientes, calorias, tiempo_preparacion, destacado, descuento_porcentaje) VALUES
-- La Casa de la Empanada (Restaurante ID 1)
(1, 1, 'Empanada de Carne Frita', 'Empanada tradicional de carne frita', 2.50, '/uploads/productos/empanada-carne-frita.jpg', 'Carne, cebolla, huevo, aceitunas', 300, 15, TRUE, 0),
(1, 1, 'Empanada de Carne Horno', 'Empanada tradicional de carne al horno', 2.50, '/uploads/productos/empanada-carne-horno.jpg', 'Carne, cebolla, huevo, aceitunas', 250, 20, FALSE, 0),
(1, 2, 'Empanada de Jamón y Queso', 'Clásica empanada de jamón y queso', 2.30, '/uploads/productos/empanada-jamon-queso.jpg', 'Jamón, queso mozzarella', 280, 15, TRUE, 0),
(1, 3, 'Empanada de Verdura', 'Empanada de acelga y salsa blanca', 2.30, '/uploads/productos/empanada-verdura.jpg', 'Acelga, salsa blanca, queso', 200, 15, FALSE, 0),
-- Pizza Master (Restaurante ID 2)
(2, 4, 'Pizza Muzzarella', 'Clásica pizza con salsa de tomate y mozzarella', 15.00, '/uploads/productos/pizza-muzzarella.jpg', 'Muzzarella, salsa de tomate, orégano', 800, 20, TRUE, 0),
(2, 4, 'Pizza Napolitana', 'Muzzarella, tomate en rodajas y ajo', 16.50, '/uploads/productos/pizza-napolitana.jpg', 'Muzzarella, tomate, ajo, perejil', 850, 20, FALSE, 0),
(2, 5, 'Pizza Cuatro Quesos', 'Combinación de cuatro quesos especiales', 18.00, '/uploads/productos/pizza-4-quesos.jpg', 'Muzzarella, provolone, roquefort, parmesano', 950, 25, TRUE, 0),
-- Sandwicheria Express (Restaurante ID 3)
(3, 6, 'Sandwich de Jamón y Queso', 'Clásico sandwich de jamón y queso con lechuga y tomate', 8.00, '/uploads/productos/sandwich-jamon-queso.jpg', 'Jamón, queso, lechuga, tomate, pan de molde', 400, 10, TRUE, 0),
(3, 7, 'Sandwich de Lomito', 'Lomito, lechuga, tomate, huevo y queso', 12.00, '/uploads/productos/sandwich-lomito.jpg', 'Lomito, lechuga, tomate, huevo, queso, pan francés', 600, 15, TRUE, 0),
-- La Nonna Trattoria (Restaurante ID 4)
(4, 8, 'Spaghetti a la Bolognesa', 'Pasta casera con nuestra salsa de carne lenta', 18.00, '/uploads/productos/spaghetti-bolognesa.jpg', 'Spaghetti, carne picada, tomate, cebolla, zanahoria', 700, 20, TRUE, 0),
(4, 8, 'Lasagna de Verduras', 'Capas de pasta, verduras y bechamel', 20.00, '/uploads/productos/lasagna-verduras.jpg', 'Pasta, espinaca, acelga, ricota, bechamel', 850, 25, FALSE, 0),
(4, 9, 'Salsa Pesto Genovese', 'Salsa fresca de albahaca, piñones y parmesano', 5.00, '/uploads/productos/salsa-pesto.jpg', 'Albahaca, piñones, parmesano, ajo, aceite de oliva', 300, 5, FALSE, 0),
(4, 10, 'Tiramisú Casero', 'El clásico postre italiano con café y mascarpone', 9.00, '/uploads/productos/tiramisu.jpg', 'Vainillas, café, mascarpone, huevos, cacao', 450, 10, TRUE, 0),
-- El Rincón del Sabor (Restaurante ID 5)
(5, 11, 'Milanesa con Papas Fritas', 'Clásica milanesa de ternera con guarnición', 14.00, '/uploads/productos/milanesa-fritas.jpg', 'Milanesa de ternera, papas, huevo, pan rallado', 900, 20, TRUE, 0),
(5, 11, 'Ensalada Caesar con Pollo', 'Ensalada fresca con pollo a la parrilla', 12.00, '/uploads/productos/ensalada-caesar-pollo.jpg', 'Lechuga, pollo, crutones, parmesano, aderezo Caesar', 400, 15, FALSE, 0),
(5, 12, 'Porción de Papas Fritas', 'Crujientes papas fritas', 4.00, '/uploads/productos/papas-fritas.jpg', 'Papas, aceite, sal', 350, 10, FALSE, 0),
(5, 13, 'Gaseosa Regular', 'Variedad de sabores (Coca-Cola, Sprite, etc.)', 3.00, '/uploads/productos/gaseosa.jpg', 'Agua carbonatada, azúcar, saborizantes', 150, 2, FALSE, 0);


-- Insertar opciones de productos
INSERT INTO opciones_productos (producto_id, nombre, tipo, requerido, orden_display) VALUES
-- Pizza Muzzarella - Tamaño (Producto ID 5)
(5, 'Tamaño', 'radio', TRUE, 1),
-- Pizza Napolitana - Tamaño (Producto ID 6)
(6, 'Tamaño', 'radio', TRUE, 1),
-- Pizza Cuatro Quesos - Tamaño (Producto ID 7)
(7, 'Tamaño', 'radio', TRUE, 1),
-- Spaghetti a la Bolognesa - Tipo de Pasta (Producto ID 8)
(8, 'Tipo de Pasta', 'radio', TRUE, 1);


-- Insertar valores de opciones
INSERT INTO valores_opciones (opcion_id, nombre, precio_adicional, orden_display) VALUES
-- Tamaños de pizza (opciones 1, 2, 3 - corresponden a productos 5, 6, 7)
(1, 'Individual (20cm)', 0.00, 1),
(1, 'Mediana (30cm)', 5.00, 2),
(1, 'Grande (40cm)', 10.00, 3),
(2, 'Individual (20cm)', 0.00, 1),
(2, 'Mediana (30cm)', 5.00, 2),
(2, 'Grande (40cm)', 10.00, 3),
(3, 'Individual (20cm)', 0.00, 1),
(3, 'Mediana (30cm)', 5.00, 2),
(3, 'Grande (40cm)', 10.00, 3),
-- Tipo de Pasta para Spaghetti a la Bolognesa (Opción ID 4 - corresponde a producto 8)
(4, 'Spaghetti', 0.00, 1),
(4, 'Fideos', 0.00, 2),
(4, 'Tallarines', 0.00, 3);

-- Insertar cupones de ejemplo
INSERT INTO cupones (codigo, descripcion, tipo, valor, pedido_minimo, limite_uso, fecha_inicio, fecha_fin, aplicable_a) VALUES
('BIENVENIDO20', 'Descuento de bienvenida del 20%', 'porcentaje', 20.00, 15.00, 100, '2024-01-01', '2024-12-31', 'todos'),
('DELIVERY5', 'Descuento fijo de $5 en delivery', 'monto_fijo', 5.00, 20.00, NULL, '2024-01-01', '2024-12-31', 'todos'),
('PASTA10', 'Descuento del 10% en La Nonna Trattoria', 'porcentaje', 10.00, 25.00, 50, '2024-01-01', '2024-12-31', 'restaurante_especifico');


-- Insertar configuraciones del sistema
INSERT INTO configuraciones (clave, valor, descripcion, tipo) VALUES
('app_name', 'A la Mesa', 'Nombre de la aplicación', 'string'),
('delivery_radius_km', '15', 'Radio de delivery en kilómetros', 'number'),
('min_order_amount', '10.00', 'Monto mínimo de pedido general', 'number'),
('tax_percentage', '21.00', 'Porcentaje de impuestos (IVA)', 'number'),
('service_fee_percentage', '5.00', 'Comisión de servicio', 'number'),
('max_delivery_time', '90', 'Tiempo máximo de delivery en minutos', 'number'),
('support_phone', '+5411-0800-MESA', 'Teléfono de soporte', 'string'),
('support_email', 'soporte@alamesa.com', 'Email de soporte', 'string'),
('app_version', '1.0.0', 'Versión actual de la aplicación', 'string'),
('comision_porcentaje', '10.00', 'Porcentaje de comisión sobre ventas brutas', 'number'),
('dias_vencimiento_cobro', '7', 'Días para vencimiento de cobros desde fin de semana', 'number'),
('metodos_pago_permitidos', '["transferencia","deposito","mercadopago","efectivo","otro"]', 'Métodos de pago permitidos para restaurantes', 'json'),
('moneda_sistema', 'ARS', 'Moneda del sistema', 'string'),
('email_admin_notificaciones', 'admin@alamesa.com', 'Email para notificaciones administrativas', 'string'),
('generar_cobros_automatico', 'true', 'Generar cobros automáticamente cada lunes', 'boolean'),
('tamaño_maximo_comprobante', '10485760', 'Tamaño máximo de comprobante en bytes (10MB)', 'number');


-- Crear algunos pedidos de ejemplo
INSERT INTO pedidos (numero_pedido, cliente_id, restaurante_id, repartidor_id, direccion_entrega, latitud_entrega, longitud_entrega, subtotal, costo_delivery, total, estado, metodo_pago, tiempo_estimado) VALUES
('ALM-2024-001', 2, 1, 9, 'Av. Libertador 1234, Apartamento 5B', -34.603722, -58.381592, 35.90, 4.50, 40.40, 'entregado', 'tarjeta', 45),
('ALM-2024-002', 3, 2, 10, 'Calle Florida 9876', -34.604722, -58.382592, 21.90, 3.00, 24.90, 'en_camino', 'efectivo', 25),
('ALM-2024-003', 2, 3, 9, 'Av. Libertador 1234, Apartamento 5B', -34.603722, -58.381592, 28.90, 5.00, 33.90, 'preparando', 'tarjeta', 30),
('ALM-2024-004', 3, 4, 10, 'Av. Corrientes 5678', -34.603945, -58.381234, 40.00, 4.00, 44.00, 'preparando', 'mercadopago', 35),
('ALM-2024-005', 2, 5, 9, 'Calle Florida 9876', -34.604722, -58.382592, 25.00, 5.00, 30.00, 'pendiente', 'transferencia', 40);

-- Insertar items de pedidos
INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 2.50, 2.50), -- Empanada de Carne Frita
(1, 3, 1, 2.30, 2.30), -- Empanada de Jamón y Queso
(2, 5, 1, 15.00, 15.00), -- Pizza Muzzarella
(3, 7, 1, 12.00, 12.00), -- Sandwich de Lomito
(4, 8, 1, 18.00, 18.00), -- Spaghetti a la Bolognesa
(4, 10, 1, 9.00, 9.00), -- Tiramisú Casero
(5, 11, 1, 14.00, 14.00), -- Milanesa con Papas Fritas
(5, 13, 2, 3.00, 6.00); -- Gaseosa Regular

-- Insertar algunas calificaciones
INSERT INTO calificaciones (pedido_id, cliente_id, restaurante_id, repartidor_id, calificacion_restaurante, calificacion_repartidor, comentario_restaurante, comentario_repartidor) VALUES
(1, 2, 1, 9, 5, 5, 'Excelente calidad de la carne, llegó caliente y en perfecto estado', 'Muy puntual y amable'),
(2, 3, 2, 10, 4, 4, 'Buena pizza, llegó a tiempo', 'Amable y rápido'),
(3, 2, 3, 9, 4, 5, 'El lomito estaba muy rico', 'Excelente servicio');

-- Insertar algunos favoritos
INSERT INTO favoritos (cliente_id, restaurante_id) VALUES
(2, 1),
(2, 2),
(3, 2),
(3, 3),
(2, 4), -- Favorito para La Nonna
(3, 5); -- Favorito para El Rincón

-- ========== DATOS DEL SISTEMA DE COBROS ==========

-- Insertar ventas diarias para el cálculo de comisiones
INSERT INTO ventas_diarias (restaurante_id, fecha, cantidad_pedidos, monto_ventas, monto_comisiones) VALUES
-- La Casa de la Empanada (Restaurante ID 1)
(1, '2024-01-01', 12, 1250.00, 125.00),
(1, '2024-01-02', 15, 1680.50, 168.05),
(1, '2024-01-03', 18, 2100.75, 210.08),
-- Pizza Master (Restaurante ID 2)
(2, '2024-01-01', 18, 1890.00, 189.00),
(2, '2024-01-02', 22, 2340.50, 234.05),
(2, '2024-01-03', 25, 2650.75, 265.08),
-- Sandwicheria Express (Restaurante ID 3)
(3, '2024-01-01', 10, 1150.00, 115.00),
(3, '2024-01-02', 14, 1580.50, 158.05),
(3, '2024-01-03', 16, 1820.75, 182.08),
-- La Nonna Trattoria (Restaurante ID 4)
(4, '2024-01-01', 8, 900.00, 90.00),
(4, '2024-01-02', 10, 1100.00, 110.00),
-- El Rincón del Sabor (Restaurante ID 5)
(5, '2024-01-01', 7, 750.00, 75.00),
(5, '2024-01-02', 9, 950.00, 95.00);

INSERT IGNORE INTO cobros_semanales (restaurante_id, semana_inicio, semana_fin, ventas_brutas, porcentaje_comision, monto_comision, estado, fecha_vencimiento, notas) VALUES
(1, '2024-01-01', '2024-01-07', 14371.00, 10.00, 1437.10, 'pagado', '2024-01-14', 'Pagado a tiempo'),
(2, '2024-01-01', '2024-01-07', 17401.75, 10.00, 1740.18, 'pagado', '2024-01-14', 'Pagado a tiempo'),
(3, '2024-01-01', '2024-01-07', 12730.50, 10.00, 1273.05, 'pendiente', '2024-01-14', NULL),
(4, '2024-01-01', '2024-01-07', 2000.00, 10.00, 200.00, 'pendiente', '2024-01-14', NULL),
(5, '2024-01-01', '2024-01-07', 1700.00, 10.00, 170.00, 'pendiente', '2024-01-14', NULL);

-- Insertar comprobantes de pago
INSERT INTO comprobantes_pago (cobro_semanal_id, restaurante_id, archivo_comprobante, metodo_pago, referencia_pago, monto_pagado, fecha_pago_declarada, estado, fecha_subida, fecha_revision, admin_revisor_id, comentarios_admin, comentarios_restaurante) VALUES
(1, 1, 'comprobante-1705123456789.jpg', 'transferencia', 'TRANS001234567', 1437.10, '2024-01-13', 'aprobado', '2024-01-13 10:30:00', '2024-01-13 14:20:00', 1, 'Comprobante válido, pago confirmado', 'Transferencia realizada desde cuenta empresarial');

-- Insertar actividad de administradores
INSERT INTO actividad_admin (admin_id, accion, descripcion, entidad_tipo, entidad_id, datos_anteriores, datos_nuevos, fecha_accion, ip_address) VALUES
(1, 'aprobar_pago', 'Comprobante aprobado para La Parrilla', 'comprobante', 1, NULL, '{"estado": "aprobado", "monto": 1437.10}', '2024-01-13 14:20:00', '192.168.1.100');

-- Insertar algunas notificaciones del sistema
INSERT INTO notificaciones_sistema (usuario_id, tipo, titulo, mensaje, leida, url_accion, fecha_creacion) VALUES
(4, 'nuevo_cobro', 'Nuevo cobro generado', 'Se ha generado un nuevo cobro por $1387.23 correspondiente a la semana del 08-14 enero. Vencimiento: 21 enero 2024.', FALSE, '/dashboard/cobros', '2024-01-15 08:30:00');

-- Habilitar la verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 1;
