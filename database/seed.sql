-- Datos de ejemplo para A la Mesa
USE a_la_mesa;

-- Insertar usuarios de ejemplo (password para todos: "123456")
INSERT INTO usuarios (nombre, apellido, email, password, telefono, tipo_usuario, imagen_perfil) VALUES
('Administrador', 'Sistema', 'admin@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567890', 'admin', 'admin.jpg'),
('Juan', 'Pérez', 'demo@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567891', 'cliente', 'user1.jpg'),
('María', 'González', 'maria@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567892', 'cliente', 'user2.jpg'),
('Restaurante', 'La Parrilla', 'restaurante@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567893', 'restaurante', 'rest1.jpg'),
('Pizzería', 'Roma', 'roma@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567894', 'restaurante', 'rest2.jpg'),
('Comida', 'Asiática Express', 'asiatica@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567895', 'restaurante', 'rest3.jpg'),
('Carlos', 'Repartidor', 'carlos.repartidor@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567896', 'repartidor', 'delivery1.jpg'),
('Ana', 'Delivery', 'ana.delivery@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567897', 'repartidor', 'delivery2.jpg');

-- Insertar direcciones de ejemplo
INSERT INTO direcciones (usuario_id, nombre, direccion, ciudad, latitud, longitud, es_principal) VALUES
(2, 'Casa', 'Av. Libertador 1234, Apartamento 5B', 'Buenos Aires', -34.603722, -58.381592, TRUE),
(2, 'Trabajo', 'Av. Corrientes 5678', 'Buenos Aires', -34.603945, -58.381234, FALSE),
(3, 'Casa', 'Calle Florida 9876', 'Buenos Aires', -34.604722, -58.382592, TRUE);

-- Insertar categorías de restaurantes
INSERT INTO categorias_restaurantes (nombre, descripcion, imagen, orden_display) VALUES
('Comida Rápida', 'Hamburguesas, papas fritas y más', 'fast-food.jpg', 1),
('Pizza', 'Las mejores pizzas de la ciudad', 'pizza.jpg', 2),
('Parrilla', 'Carnes a la parrilla y asados', 'grill.jpg', 3),
('Asiática', 'Sushi, comida china y tailandesa', 'asian.jpg', 4),
('Italiana', 'Pastas, risottos y platos tradicionales', 'italian.jpg', 5),
('Mexicana', 'Tacos, burritos y comida tex-mex', 'mexican.jpg', 6),
('Saludable', 'Ensaladas, bowls y comida fit', 'healthy.jpg', 7),
('Postres', 'Helados, pasteles y dulces', 'desserts.jpg', 8);

-- Insertar restaurantes
INSERT INTO restaurantes (usuario_id, nombre, descripcion, imagen_logo, imagen_banner, direccion, ciudad, telefono, email_contacto, latitud, longitud, horario_apertura, horario_cierre, dias_operacion, tiempo_entrega_min, tiempo_entrega_max, costo_delivery, pedido_minimo, calificacion_promedio, total_calificaciones, verificado) VALUES
(4, 'La Parrilla Argentina', 'Las mejores carnes a la parrilla con tradición familiar desde 1980', 'parrilla-logo.jpg', 'parrilla-banner.jpg', 'Av. Santa Fe 2456', 'Buenos Aires', '+5411-4567-8901', 'contacto@laparrilla.com', -34.603722, -58.381592, '11:00:00', '23:30:00', '[1,2,3,4,5,6,7]', 35, 50, 4.50, 15.00, 4.7, 156, TRUE),
(5, 'Pizzería Roma', 'Auténtica pizza italiana con ingredientes importados directamente de Italia', 'roma-logo.jpg', 'roma-banner.jpg', 'Av. Corrientes 3789', 'Buenos Aires', '+5411-4567-8902', 'pedidos@pizzeriaroma.com', -34.604945, -58.382234, '18:00:00', '01:00:00', '[1,2,3,4,5,6,7]', 25, 40, 3.00, 12.00, 4.5, 203, TRUE),
(6, 'Asiática Express', 'Fusión asiática moderna: sushi, wok y platos tradicionales', 'asiatica-logo.jpg', 'asiatica-banner.jpg', 'Av. Las Heras 1567', 'Buenos Aires', '+5411-4567-8903', 'info@asiaticaexpress.com', -34.605722, -58.383592, '12:00:00', '22:00:00', '[2,3,4,5,6,7]', 30, 45, 5.00, 18.00, 4.3, 89, TRUE);

-- Insertar relación restaurante-categorías
INSERT INTO restaurante_categorias (restaurante_id, categoria_id) VALUES
(1, 3), -- La Parrilla -> Parrilla
(2, 2), -- Roma -> Pizza
(2, 5), -- Roma -> Italiana
(3, 4); -- Asiática Express -> Asiática

-- Insertar categorías de productos
INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display) VALUES
-- La Parrilla
(1, 'Parrilladas', 'Selección de carnes a la parrilla', 1),
(1, 'Empanadas', 'Empanadas caseras horneadas', 2),
(1, 'Ensaladas', 'Ensaladas frescas y acompañamientos', 3),
(1, 'Postres', 'Dulces tradicionales argentinos', 4),
-- Pizzería Roma
(2, 'Pizzas Clásicas', 'Nuestras pizzas tradicionales más populares', 1),
(2, 'Pizzas Gourmet', 'Creaciones especiales del chef', 2),
(2, 'Pastas', 'Pastas frescas hechas en casa', 3),
(2, 'Entradas', 'Para comenzar tu experiencia italiana', 4),
-- Asiática Express
(3, 'Sushi & Rolls', 'Piezas frescas preparadas al momento', 1),
(3, 'Wok', 'Salteados al wok con vegetales frescos', 2),
(3, 'Sopas', 'Caldos tradicionales asiáticos', 3),
(3, 'Postres Asiáticos', 'Dulces tradicionales de Asia', 4);

-- Insertar productos
INSERT INTO productos (restaurante_id, categoria_id, nombre, descripcion, precio, imagen, ingredientes, calorias, tiempo_preparacion, destacado, descuento_porcentaje) VALUES
-- La Parrilla
(1, 1, 'Parrillada para 2', 'Asado de tira, chorizo, morcilla, pollo y ensalada mixta', 35.90, 'parrillada-2.jpg', 'Asado de tira, chorizo, morcilla, pollo, lechuga, tomate, cebolla', 1200, 25, TRUE, 0),
(1, 1, 'Bife de Chorizo', 'Corte premium de 300g con papas fritas', 22.50, 'bife-chorizo.jpg', 'Bife de chorizo, papas, sal parrillera', 800, 20, TRUE, 0),
(1, 2, 'Empanadas de Carne (6 unidades)', 'Empanadas caseras horneadas rellenas de carne', 8.90, 'empanadas-carne.jpg', 'Carne picada, cebolla, huevo duro, aceitunas, masa casera', 450, 15, FALSE, 10),
(1, 2, 'Empanadas de Pollo (6 unidades)', 'Empanadas horneadas con pollo y verduras', 8.90, 'empanadas-pollo.jpg', 'Pollo desmenuzado, verduras, masa casera', 400, 15, FALSE, 0),
(1, 3, 'Ensalada Caesar', 'Lechuga, crutones, parmesano y aderezo caesar', 12.50, 'caesar-salad.jpg', 'Lechuga romana, crutones, queso parmesano, aderezo caesar', 320, 10, FALSE, 0),

-- Pizzería Roma
(2, 5, 'Pizza Margherita', 'Salsa de tomate, mozzarella, albahaca fresca', 18.90, 'pizza-margherita.jpg', 'Masa artesanal, salsa de tomate, mozzarella, albahaca', 650, 18, TRUE, 0),
(2, 5, 'Pizza Pepperoni', 'Salsa de tomate, mozzarella, pepperoni italiano', 21.90, 'pizza-pepperoni.jpg', 'Masa artesanal, salsa de tomate, mozzarella, pepperoni', 720, 18, TRUE, 0),
(2, 6, 'Pizza Quattro Stagioni', 'Tomate, mozzarella, jamón, champiñones, alcachofas, aceitunas', 25.90, 'pizza-quattro.jpg', 'Masa artesanal, tomate, mozzarella, jamón, champiñones, alcachofas, aceitunas', 780, 20, TRUE, 5),
(2, 7, 'Spaghetti Carbonara', 'Pasta fresca con panceta, huevo y parmesano', 19.50, 'carbonara.jpg', 'Spaghetti fresco, panceta, huevo, queso parmesano, pimienta', 680, 15, FALSE, 0),
(2, 8, 'Bruschetta Clásica', 'Pan tostado con tomate, albahaca y aceite de oliva', 9.90, 'bruschetta.jpg', 'Pan artesanal, tomate, albahaca, aceite de oliva extra virgen', 280, 8, FALSE, 0),

-- Asiática Express
(3, 9, 'Combo Sushi (20 piezas)', 'Salmón, atún, palta y philadelphia rolls', 28.90, 'combo-sushi.jpg', 'Arroz sushi, salmón, atún, palta, queso philadelphia, nori', 520, 25, TRUE, 0),
(3, 9, 'California Roll (8 piezas)', 'Palta, pepino, surimi y sésamo', 15.90, 'california-roll.jpg', 'Arroz sushi, palta, pepino, surimi, sésamo, nori', 320, 15, FALSE, 0),
(3, 10, 'Wok de Pollo Teriyaki', 'Pollo salteado con vegetales y salsa teriyaki', 16.90, 'wok-pollo.jpg', 'Pollo, brócoli, zanahoria, pimiento, salsa teriyaki, arroz', 580, 12, TRUE, 0),
(3, 10, 'Pad Thai de Camarones', 'Fideos de arroz salteados con camarones y vegetales', 19.90, 'pad-thai.jpg', 'Fideos de arroz, camarones, brotes de soja, huevo, salsa pad thai', 620, 15, FALSE, 0),
(3, 11, 'Ramen de Cerdo', 'Caldo tradicional con cerdo, huevo y vegetales', 17.50, 'ramen-cerdo.jpg', 'Fideos ramen, caldo de cerdo, huevo, cebollín, brotes de bambú', 480, 20, FALSE, 0);

-- Insertar opciones de productos
INSERT INTO opciones_productos (producto_id, nombre, tipo, requerido, orden_display) VALUES
-- Pizza Margherita - Tamaño
(6, 'Tamaño', 'radio', TRUE, 1),
-- Pizza Pepperoni - Tamaño
(7, 'Tamaño', 'radio', TRUE, 1),
-- Pizza Quattro Stagioni - Tamaño  
(8, 'Tamaño', 'radio', TRUE, 1),
-- Bife de Chorizo - Cocción
(2, 'Punto de Cocción', 'radio', TRUE, 1),
-- Bife de Chorizo - Acompañamientos
(2, 'Acompañamientos Extra', 'checkbox', FALSE, 2);

-- Insertar valores de opciones
INSERT INTO valores_opciones (opcion_id, nombre, precio_adicional, orden_display) VALUES
-- Tamaños de pizza (opciones 1, 2, 3)
(1, 'Personal (25cm)', 0.00, 1),
(1, 'Mediana (30cm)', 5.00, 2),
(1, 'Familiar (35cm)', 10.00, 3),
(2, 'Personal (25cm)', 0.00, 1),
(2, 'Mediana (30cm)', 5.00, 2),
(2, 'Familiar (35cm)', 10.00, 3),
(3, 'Personal (25cm)', 0.00, 1),
(3, 'Mediana (30cm)', 5.00, 2),
(3, 'Familiar (35cm)', 10.00, 3),
-- Punto de cocción bife (opción 4)
(4, 'Jugoso', 0.00, 1),
(4, 'A punto', 0.00, 2),
(4, 'Bien cocido', 0.00, 3),
-- Acompañamientos extra (opción 5)
(5, 'Ensalada mixta', 3.50, 1),
(5, 'Papas al horno', 2.50, 2),
(5, 'Verduras grilladas', 4.00, 3);

-- Insertar cupones de ejemplo
INSERT INTO cupones (codigo, descripcion, tipo, valor, pedido_minimo, limite_uso, fecha_inicio, fecha_fin, aplicable_a) VALUES
('BIENVENIDO20', 'Descuento de bienvenida del 20%', 'porcentaje', 20.00, 15.00, 100, '2024-01-01', '2024-12-31', 'todos'),
('DELIVERY5', 'Descuento fijo de $5 en delivery', 'monto_fijo', 5.00, 20.00, NULL, '2024-01-01', '2024-12-31', 'todos'),
('PIZZA15', 'Descuento del 15% en Pizzería Roma', 'porcentaje', 15.00, 12.00, 50, '2024-01-01', '2024-06-30', 'restaurante_especifico');

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
('app_version', '1.0.0', 'Versión actual de la aplicación', 'string');

-- Crear algunos pedidos de ejemplo
INSERT INTO pedidos (numero_pedido, cliente_id, restaurante_id, repartidor_id, direccion_entrega, latitud_entrega, longitud_entrega, subtotal, costo_delivery, total, estado, metodo_pago, tiempo_estimado) VALUES
('ALM-2024-001', 2, 1, 7, 'Av. Libertador 1234, Apartamento 5B', -34.603722, -58.381592, 35.90, 4.50, 40.40, 'entregado', 'tarjeta', 45),
('ALM-2024-002', 3, 2, 8, 'Calle Florida 9876', -34.604722, -58.382592, 21.90, 3.00, 24.90, 'en_camino', 'efectivo', 25),
('ALM-2024-003', 2, 3, 7, 'Av. Libertador 1234, Apartamento 5B', -34.603722, -58.381592, 28.90, 5.00, 33.90, 'preparando', 'tarjeta', 30);

-- Insertar items de pedidos
INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 35.90, 35.90),
(2, 7, 1, 21.90, 21.90),
(3, 11, 1, 28.90, 28.90);

-- Insertar algunas calificaciones
INSERT INTO calificaciones (pedido_id, cliente_id, restaurante_id, repartidor_id, calificacion_restaurante, calificacion_repartidor, comentario_restaurante, comentario_repartidor) VALUES
(1, 2, 1, 7, 5, 5, 'Excelente calidad de la carne, llegó caliente y en perfecto estado', 'Muy puntual y amable');

-- Insertar algunos favoritos
INSERT INTO favoritos (cliente_id, restaurante_id) VALUES
(2, 1),
(2, 2),
(3, 2),
(3, 3);

-- ========== DATOS DEL SISTEMA DE COBROS ==========

-- Insertar ventas diarias para el cálculo de comisiones
INSERT INTO ventas_diarias (restaurante_id, fecha, cantidad_pedidos, monto_ventas, monto_comisiones) VALUES
-- La Parrilla (últimas 2 semanas)
(1, '2024-01-01', 12, 1250.00, 125.00),
(1, '2024-01-02', 15, 1680.50, 168.05),
(1, '2024-01-03', 18, 2100.75, 210.08),
(1, '2024-01-04', 22, 2450.00, 245.00),
(1, '2024-01-05', 25, 2890.25, 289.03),
(1, '2024-01-06', 20, 2200.00, 220.00),
(1, '2024-01-07', 16, 1850.50, 185.05),
(1, '2024-01-08', 14, 1520.00, 152.00),
(1, '2024-01-09', 19, 2150.75, 215.08),
(1, '2024-01-10', 21, 2380.00, 238.00),
(1, '2024-01-11', 23, 2560.50, 256.05),
(1, '2024-01-12', 18, 2020.25, 202.03),
(1, '2024-01-13', 17, 1890.00, 189.00),
(1, '2024-01-14', 13, 1450.75, 145.08),

-- Pizzería Roma (últimas 2 semanas)
(2, '2024-01-01', 18, 1890.00, 189.00),
(2, '2024-01-02', 22, 2340.50, 234.05),
(2, '2024-01-03', 25, 2650.75, 265.08),
(2, '2024-01-04', 28, 2980.00, 298.00),
(2, '2024-01-05', 30, 3200.25, 320.03),
(2, '2024-01-06', 26, 2780.00, 278.00),
(2, '2024-01-07', 24, 2560.50, 256.05),
(2, '2024-01-08', 20, 2120.00, 212.00),
(2, '2024-01-09', 27, 2890.75, 289.08),
(2, '2024-01-10', 29, 3100.00, 310.00),
(2, '2024-01-11', 31, 3320.50, 332.05),
(2, '2024-01-12', 25, 2680.25, 268.03),
(2, '2024-01-13', 23, 2450.00, 245.00),
(2, '2024-01-14', 19, 2030.75, 203.08),

-- Asiática Express (últimas 2 semanas)
(3, '2024-01-01', 10, 1150.00, 115.00),
(3, '2024-01-02', 14, 1580.50, 158.05),
(3, '2024-01-03', 16, 1820.75, 182.08),
(3, '2024-01-04', 19, 2150.00, 215.00),
(3, '2024-01-05', 21, 2390.25, 239.03),
(3, '2024-01-06', 17, 1930.00, 193.00),
(3, '2024-01-07', 15, 1710.50, 171.05),
(3, '2024-01-08', 12, 1380.00, 138.00),
(3, '2024-01-09', 18, 2050.75, 205.08),
(3, '2024-01-10', 20, 2280.00, 228.00),
(3, '2024-01-11', 22, 2510.50, 251.05),
(3, '2024-01-12', 16, 1820.25, 182.03),
(3, '2024-01-13', 14, 1590.00, 159.00),
(3, '2024-01-14', 11, 1250.75, 125.08);

-- Insertar cobros semanales
INSERT INTO cobros_semanales (restaurante_id, semana_inicio, semana_fin, ventas_brutas, porcentaje_comision, monto_comision, estado, fecha_vencimiento, notas) VALUES
-- Semana 1 (1-7 enero 2024)
(1, '2024-01-01', '2024-01-07', 14371.00, 10.00, 1437.10, 'pagado', '2024-01-14', 'Pagado a tiempo'),
(2, '2024-01-01', '2024-01-07', 17401.75, 10.00, 1740.18, 'pagado', '2024-01-14', 'Pagado a tiempo'),
(3, '2024-01-01', '2024-01-07', 12730.50, 10.00, 1273.05, 'pendiente', '2024-01-14', NULL),

-- Semana 2 (8-14 enero 2024)
(1, '2024-01-08', '2024-01-14', 13872.25, 10.00, 1387.23, 'pendiente', '2024-01-21', NULL),
(2, '2024-01-08', '2024-01-14', 17592.25, 10.00, 1759.23, 'pendiente', '2024-01-21', NULL),
(3, '2024-01-08', '2024-01-14', 12882.50, 10.00, 1288.25, 'vencido', '2024-01-21', 'Pago vencido');

-- Insertar comprobantes de pago
INSERT INTO comprobantes_pago (cobro_semanal_id, restaurante_id, archivo_comprobante, metodo_pago, referencia_pago, monto_pagado, fecha_pago_declarada, estado, fecha_subida, fecha_revision, admin_revisor_id, comentarios_admin, comentarios_restaurante) VALUES
-- Comprobantes para La Parrilla (cobro pagado)
(1, 1, 'comprobante-1705123456789.jpg', 'transferencia', 'TRANS001234567', 1437.10, '2024-01-13', 'aprobado', '2024-01-13 10:30:00', '2024-01-13 14:20:00', 1, 'Comprobante válido, pago confirmado', 'Transferencia realizada desde cuenta empresarial'),

-- Comprobantes para Pizzería Roma (cobro pagado)
(2, 2, 'comprobante-1705223456789.pdf', 'mercadopago', 'MP-240113-987654321', 1740.18, '2024-01-12', 'aprobado', '2024-01-12 16:45:00', '2024-01-13 09:15:00', 1, 'Pago de MercadoPago verificado correctamente', 'Pago realizado a través de la app de MercadoPago'),

-- Comprobante pendiente para Asiática Express
(6, 3, 'comprobante-1705323456789.jpg', 'deposito', 'DEP-789123456', 1288.25, '2024-01-22', 'pendiente', '2024-01-22 11:20:00', NULL, NULL, NULL, 'Depósito realizado en sucursal Banco Nación');

-- Insertar actividad de administradores
INSERT INTO actividad_admin (admin_id, accion, descripcion, entidad_tipo, entidad_id, datos_anteriores, datos_nuevos, fecha_accion, ip_address) VALUES
(1, 'aprobar_pago', 'Comprobante aprobado para La Parrilla', 'comprobante', 1, NULL, '{"estado": "aprobado", "monto": 1437.10}', '2024-01-13 14:20:00', '192.168.1.100'),
(1, 'aprobar_pago', 'Comprobante aprobado para Pizzería Roma', 'comprobante', 2, NULL, '{"estado": "aprobado", "monto": 1740.18}', '2024-01-13 09:15:00', '192.168.1.100'),
(1, 'generar_cobro', 'Generados cobros para semana 01-07 enero 2024', 'cobro', NULL, NULL, '{"cobros_generados": 3, "periodo": "2024-01-01_2024-01-07"}', '2024-01-08 08:00:00', '192.168.1.100'),
(1, 'generar_cobro', 'Generados cobros para semana 08-14 enero 2024', 'cobro', NULL, NULL, '{"cobros_generados": 3, "periodo": "2024-01-08_2024-01-14"}', '2024-01-15 08:00:00', '192.168.1.100');

-- Insertar algunas notificaciones del sistema
INSERT INTO notificaciones_sistema (usuario_id, tipo, titulo, mensaje, leida, url_accion, fecha_creacion) VALUES
-- Notificaciones para restaurantes
(4, 'nuevo_cobro', 'Nuevo cobro generado', 'Se ha generado un nuevo cobro por $1387.23 correspondiente a la semana del 08-14 enero. Vencimiento: 21 enero 2024.', FALSE, '/dashboard/cobros', '2024-01-15 08:30:00'),
(5, 'nuevo_cobro', 'Nuevo cobro generado', 'Se ha generado un nuevo cobro por $1759.23 correspondiente a la semana del 08-14 enero. Vencimiento: 21 enero 2024.', FALSE, '/dashboard/cobros', '2024-01-15 08:30:00'),
(6, 'vencimiento_proximo', 'Cobro próximo a vencer', 'Tienes un cobro por $1288.25 que vence mañana. Por favor, realiza el pago y sube tu comprobante.', FALSE, '/dashboard/cobros', '2024-01-20 09:00:00'),
(4, 'pago_aprobado', 'Pago aprobado', 'Tu comprobante de pago por $1437.10 ha sido aprobado. El cobro se marca como pagado.', TRUE, '/dashboard/cobros', '2024-01-13 14:25:00'),
(5, 'pago_aprobado', 'Pago aprobado', 'Tu comprobante de pago por $1740.18 ha sido aprobado. El cobro se marca como pagado.', TRUE, '/dashboard/cobros', '2024-01-13 09:20:00');

-- Insertar configuraciones del sistema
INSERT INTO configuraciones (clave, valor, descripcion, tipo) VALUES
('comision_porcentaje', '10.00', 'Porcentaje de comisión sobre ventas brutas', 'number'),
('dias_vencimiento_cobro', '7', 'Días para vencimiento de cobros desde fin de semana', 'number'),
('metodos_pago_permitidos', '["transferencia","deposito","mercadopago","efectivo","otro"]', 'Métodos de pago permitidos para restaurantes', 'json'),
('moneda_sistema', 'ARS', 'Moneda del sistema', 'string'),
('email_admin_notificaciones', 'admin@alamesa.com', 'Email para notificaciones administrativas', 'string'),
('generar_cobros_automatico', 'true', 'Generar cobros automáticamente cada lunes', 'boolean'),
('tamaño_maximo_comprobante', '10485760', 'Tamaño máximo de comprobante en bytes (10MB)', 'number');
