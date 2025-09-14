-- Backup created on 2025-09-06T19:54:45.777Z

-- Table: actividad_admin
INSERT INTO actividad_admin (id, admin_id, accion, descripcion, entidad_tipo, entidad_id, datos_anteriores, datos_nuevos, fecha_accion, ip_address) VALUES 
(1, 1, 'aprobar_pago', 'Comprobante aprobado para La Parrilla', 'comprobante', 1, NULL, `monto` = 1437.1, `estado` = 'aprobado', '2024-01-13 14:20:00.000', '192.168.1.100'),
(2, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 3, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-06-16 15:52:41.000', '::1'),
(3, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-06-09 - 2025-06-16', 'cobro', NULL, NULL, `periodo` = '2025-06-09_2025-06-16', `cobros_generados` = 1, '2025-06-16 19:05:24.000', '::1'),
(4, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-06-12 - 2025-06-19', 'cobro', NULL, NULL, `periodo` = '2025-06-12_2025-06-19', `cobros_generados` = 1, '2025-06-18 22:40:57.000', '::1'),
(5, 1, 'aprobar_pago', 'Comprobante aprobardo', 'comprobante', 4, NULL, `accion` = 'aprobar', `comentarios` = '', '2025-06-18 23:13:09.000', '::1'),
(6, 1, 'editar_restaurante', 'Restaurante editado: el torito', 'restaurante', 9, `id` = 9, `activo` = 1, `ciudad` = 'colon', `nombre` = 'el torito', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '32432444', `direccion` = '42343', `usuario_id` = 14, `verificado` = 0, `descripcion` = 'dweqweeqwwewqeqweewewqew', `imagen_logo` = NULL, `imagen_banner` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'restaurante@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = 'restaurante@hotmail.com', `fecha_registro` = '2025-06-28T22:33:31.000Z', `horario_cierre` = '23:00:00', `pedidos_online` = 1, `usuario_nombre` = 'asdsda', `horario_apertura` = '14:00:00', `usuario_apellido` = 'ewqewqqwe', `usuario_telefono` = '423423552532', `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `datos_transferencia_alias` = NULL, `datos_transferencia_titular` = NULL, `email` = 'restaurante@hotmail.com', `activo` = 1, `nombre` = 'el torito', '2025-06-28 20:13:57.000', '::1'),
(7, 1, 'editar_restaurante', 'Restaurante editado: El Torito', 'restaurante', 9, `id` = 9, `activo` = 1, `ciudad` = 'colon', `nombre` = 'el torito', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '32432444', `direccion` = '42343', `usuario_id` = 14, `verificado` = 1, `descripcion` = 'dweqweeqwwewqeqweewewqew', `imagen_logo` = NULL, `imagen_banner` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'restaurante@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = 'restaurante@hotmail.com', `fecha_registro` = '2025-06-28T22:33:31.000Z', `horario_cierre` = '23:00:00', `pedidos_online` = 1, `usuario_nombre` = 'asdsda43242', `horario_apertura` = '14:00:00', `usuario_apellido` = 'ewqewqqwe', `usuario_telefono` = '423423552532', `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `datos_transferencia_alias` = NULL, `datos_transferencia_titular` = NULL, `email` = 'restaurante@hotmail.com', `activo` = 1, `nombre` = 'El Torito', '2025-06-28 20:15:50.000', '::1'),
(8, 1, 'editar_restaurante', 'Restaurante editado: El Torito', 'restaurante', 9, `id` = 9, `activo` = 1, `ciudad` = 'colon', `nombre` = 'El Torito', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '32432444', `direccion` = 'avellaneda 38', `usuario_id` = 14, `verificado` = 1, `descripcion` = 'dweqweeqwwewqeqweewewqew', `imagen_logo` = NULL, `imagen_banner` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'restaurante@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = 'restaurante@hotmail.com', `fecha_registro` = '2025-06-28T22:33:31.000Z', `horario_cierre` = '23:00:00', `pedidos_online` = 1, `usuario_nombre` = 'mauro', `horario_apertura` = '14:00:00', `usuario_apellido` = 'entrerriano', `usuario_telefono` = '423423552532', `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `datos_transferencia_alias` = NULL, `datos_transferencia_titular` = NULL, `email` = 'restaurante@hotmail.com', `activo` = 1, `nombre` = 'El Torito', '2025-06-28 20:20:28.000', '::1'),
(9, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-06-22 - 2025-06-29', 'cobro', NULL, NULL, `periodo` = '2025-06-22_2025-06-29', `cobros_generados` = 1, '2025-06-29 12:36:20.000', '192.168.0.103'),
(10, 1, 'eliminar_restaurante', 'Restaurante eliminado: tienda resto', 'restaurante', 10, `id` = 10, `activo` = 1, `ciudad` = 'Colón, Bs As', `nombre` = 'tienda resto', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '654768756847', `direccion` = 'qwewqewqewqq', `usuario_id` = 26, `verificado` = 0, `descripcion` = 'ewqewqfeewtergtregtregtreg', `imagen_logo` = NULL, `imagen_banner` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'tiendanexus.info@gmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = NULL, `fecha_registro` = '2025-07-14T23:11:50.000Z', `horario_cierre` = NULL, `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'dan cas', `horario_apertura` = NULL, `usuario_apellido` = 'cas', `usuario_telefono` = '4234235243243243', `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `datos_transferencia_alias` = NULL, `datos_transferencia_titular` = NULL, NULL, '2025-07-14 20:14:15.000', '127.0.0.1'),
(11, 1, 'editar_restaurante', 'Restaurante editado: tienda resto', 'restaurante', 11, `id` = 11, `activo` = 1, `ciudad` = 'Colón, Bs As', `nombre` = 'tienda resto', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '234326543526335243', `direccion` = 'qwewqewqewqq', `usuario_id` = 27, `verificado` = 0, `descripcion` = 'ewqewqfeewtergtregtregtreg', `imagen_logo` = NULL, `imagen_banner` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'tiendanexus.info@gmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = NULL, `fecha_registro` = '2025-07-14T23:14:36.000Z', `horario_cierre` = NULL, `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'dan cas', `horario_apertura` = NULL, `usuario_apellido` = 'cas', `usuario_telefono` = '4234235243243243', `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `datos_transferencia_alias` = NULL, `datos_transferencia_titular` = NULL, `email` = 'tiendanexus.info@gmail.com', `activo` = 1, `nombre` = 'tienda resto', '2025-07-14 20:16:36.000', '127.0.0.1'),
(12, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-07-08 - 2025-07-15', 'cobro', NULL, NULL, `periodo` = '2025-07-08_2025-07-15', `cobros_generados` = 1, '2025-07-15 00:02:34.000', '127.0.0.1'),
(13, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-07-14 - 2025-07-20', 'cobro', NULL, NULL, `periodo` = '2025-07-14_2025-07-20', `cobros_generados` = 1, '2025-07-21 22:36:58.000', '127.0.0.1'),
(14, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-07-19 - 2025-07-22', 'cobro', NULL, NULL, `periodo` = '2025-07-19_2025-07-22', `cobros_generados` = 1, '2025-07-21 22:38:30.000', '127.0.0.1'),
(15, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-07-15 - 2025-07-22', 'cobro', NULL, NULL, `periodo` = '2025-07-15_2025-07-22', `cobros_generados` = 1, '2025-07-21 22:43:11.000', '127.0.0.1'),
(16, 1, 'generar_cobro', 'Generados 7 cobros para período 2025-07-15 - 2025-07-22', 'cobro', NULL, NULL, `periodo` = '2025-07-15_2025-07-22', `cobros_generados` = 7, '2025-07-21 22:57:41.000', '127.0.0.1'),
(17, 1, 'generar_cobro', 'Generados 8 cobros para período 2025-03-01 - 2025-07-24', 'cobro', NULL, NULL, `periodo` = '2025-03-01_2025-07-24', `cobros_generados` = 8, '2025-07-23 22:06:08.000', '127.0.0.1'),
(18, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 12, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:01.000', '127.0.0.1'),
(19, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 20, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:09.000', '127.0.0.1'),
(20, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 13, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:13.000', '127.0.0.1'),
(21, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 10, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:19.000', '127.0.0.1'),
(22, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 9, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:24.000', '127.0.0.1'),
(23, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 21, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:30.000', '127.0.0.1'),
(24, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 27, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:35.000', '127.0.0.1'),
(25, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 28, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:38.000', '127.0.0.1'),
(26, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 4, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:08:54.000', '127.0.0.1'),
(27, 1, 'aprobar_pago', 'Cobro marcado como pagado manualmente', 'cobro', 5, NULL, `estado` = 'pagado', `pago_manual` = true, '2025-07-23 22:09:04.000', '127.0.0.1'),
(28, 1, 'generar_cobro', 'Generados 1 cobros para período 2025-07-17 - 2025-07-24', 'cobro', NULL, NULL, `periodo` = '2025-07-17_2025-07-24', `cobros_generados` = 1, '2025-07-24 13:19:40.000', '127.0.0.1'),
(29, 1, 'editar_restaurante', 'Restaurante editado: Pizzeria El 10', 'restaurante', 12, `id` = 12, `activo` = 1, `ciudad` = 'Colón, Bs As', `nombre` = 'Pizzeria El 10', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '2473000000', `direccion` = '23 e 49 y 50', `mp_user_id` = NULL, `usuario_id` = 29, `verificado` = 0, `descripcion` = 'Hacemos pizzas de todo tipo', `imagen_logo` = NULL, `mp_connected` = 0, `mp_live_mode` = NULL, `imagen_banner` = NULL, `mp_expires_in` = NULL, `mp_public_key` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'anonymus113@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = NULL, `fecha_registro` = '2025-07-26T14:52:37.000Z', `horario_cierre` = NULL, `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'Esteban', `mp_access_token` = NULL, `mp_last_updated` = NULL, `horario_apertura` = NULL, `mp_refresh_token` = NULL, `usuario_apellido` = 'Messi', `usuario_telefono` = NULL, `mercadopago_active` = 0, `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `mercadopago_access_token` = NULL, `mercadopago_collector_id` = NULL, `datos_transferencia_alias` = NULL, `datos_transferencia_titular` = NULL, `email` = 'anonymus113@hotmail.com', `activo` = 1, `nombre` = 'Pizzeria El 10', '2025-07-26 12:12:00.000', '127.0.0.1'),
(30, 1, 'generar_cobro', 'Generación automática de cobros semanales para 1 restaurantes. Total comisiones: $2.804,4', 'cobro', NULL, NULL, `fecha_fin` = '2025-09-01', `fecha_inicio` = '2025-08-25', `cobrosGenerados` = 1, `totalComisiones` = 2804.4, '2025-08-30 17:04:55.000', NULL),
(31, 1, 'aprobar_pago', 'Comprobante aprobado para La Parrilla', 'comprobante', 1, NULL, `monto` = 1437.1, `estado` = 'aprobado', '2024-01-13 14:20:00.000', '192.168.1.100'),
(32, 1, 'editar_restaurante', 'Restaurante editado: Hamburgueseria Colon', 'restaurante', 7, `id` = 7, `activo` = 1, `ciudad` = 'Colón, Bs As', `nombre` = 'Hamburgueseria Colon', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '543534543', `direccion` = 'la plaza', `mp_user_id` = NULL, `usuario_id` = 15, `verificado` = 0, `descripcion` = 'Hamburgueseria Colon, Hamburgueseria Colon, Hamburgueseria Colon', `imagen_logo` = NULL, `mp_connected` = 0, `mp_live_mode` = NULL, `imagen_banner` = NULL, `mp_expires_in` = NULL, `mp_public_key` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'tiendanexus.info@gmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = NULL, `fecha_registro` = '2025-09-06T18:43:32.000Z', `horario_cierre` = NULL, `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'esteban', `mp_access_token` = NULL, `mp_last_updated` = NULL, `horario_apertura` = NULL, `mp_refresh_token` = NULL, `usuario_apellido` = 'ramirez', `usuario_telefono` = NULL, `mercadopago_active` = 0, `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `email_notif_nuevo_pedido` = 1, `mercadopago_access_token` = NULL, `mercadopago_collector_id` = NULL, `datos_transferencia_alias` = NULL, `email_notif_cambio_estado` = 1, `datos_transferencia_titular` = NULL, `email` = 'tiendanexus.info@gmail.com', `activo` = 1, `nombre` = 'Hamburgueseria Colon', '2025-09-06 16:02:14.000', '127.0.0.1'),
(33, 1, 'aprobar_pago', 'Comprobante aprobado para La Parrilla', 'comprobante', 1, NULL, `monto` = 1437.1, `estado` = 'aprobado', '2024-01-13 14:20:00.000', '192.168.1.100'),
(34, 1, 'editar_restaurante', 'Restaurante editado: Hamburgueseria Colon', 'restaurante', 6, `id` = 6, `activo` = 0, `ciudad` = 'Colón, Bs As', `nombre` = 'Hamburgueseria Colon', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '31321321321', `direccion` = 'la plaza', `mp_user_id` = NULL, `usuario_id` = 12, `verificado` = 0, `descripcion` = 'ewqewqewewqewqewqewqweqewq', `imagen_logo` = NULL, `mp_connected` = 0, `mp_live_mode` = NULL, `imagen_banner` = NULL, `mp_expires_in` = NULL, `mp_public_key` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'restaurante@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = NULL, `fecha_registro` = '2025-09-06T19:25:42.000Z', `horario_cierre` = NULL, `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'esteban', `mp_access_token` = NULL, `mp_last_updated` = NULL, `horario_apertura` = NULL, `mp_refresh_token` = NULL, `usuario_apellido` = 'ramirez', `usuario_telefono` = NULL, `mercadopago_active` = 0, `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `email_notif_nuevo_pedido` = 1, `mercadopago_access_token` = NULL, `mercadopago_collector_id` = NULL, `datos_transferencia_alias` = NULL, `email_notif_cambio_estado` = 1, `datos_transferencia_titular` = NULL, `email` = 'restaurante@hotmail.com', `activo` = 1, `nombre` = 'Hamburgueseria Colon', '2025-09-06 16:26:09.000', '192.168.0.106'),
(35, 1, 'editar_restaurante', 'Restaurante editado: Hamburgueseria Colon', 'restaurante', 6, `id` = 6, `activo` = 1, `ciudad` = 'Colón, Bs As', `nombre` = 'Hamburgueseria Colon', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '31321321321', `direccion` = 'la plaza', `mp_user_id` = NULL, `usuario_id` = 12, `verificado` = 1, `descripcion` = 'ewqewqewewqewqewqewqweqewq', `imagen_logo` = NULL, `mp_connected` = 0, `mp_live_mode` = NULL, `imagen_banner` = NULL, `mp_expires_in` = NULL, `mp_public_key` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'restaurante@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = 1, 2, 3, 4, 5, 6, 7, `email_contacto` = NULL, `fecha_registro` = '2025-09-06T19:25:42.000Z', `horario_cierre` = '21:26:00', `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'esteban', `mp_access_token` = NULL, `mp_last_updated` = NULL, `horario_apertura` = '17:26:00', `mp_refresh_token` = NULL, `usuario_apellido` = 'ramirez', `usuario_telefono` = NULL, `mercadopago_active` = 0, `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `email_notif_nuevo_pedido` = 1, `mercadopago_access_token` = NULL, `mercadopago_collector_id` = NULL, `datos_transferencia_alias` = NULL, `email_notif_cambio_estado` = 1, `datos_transferencia_titular` = NULL, `email` = 'restaurante@hotmail.com', `activo` = 1, `nombre` = 'Hamburgueseria Colon', '2025-09-06 16:37:39.000', '192.168.0.105'),
(36, 1, 'editar_restaurante', 'Restaurante editado: U53rnykjrmebybey', 'restaurante', 7, `id` = 7, `activo` = 0, `ciudad` = 'Colón, Bs As', `nombre` = 'U53rnykjrmebybey', `latitud` = NULL, `delivery` = 0, `longitud` = NULL, `telefono` = '94554858845', `direccion` = '42343', `mp_user_id` = NULL, `usuario_id` = 13, `verificado` = 0, `descripcion` = 'Behnyenyeneyk3ykkyeky3nyebtetb', `imagen_logo` = NULL, `mp_connected` = 0, `mp_live_mode` = NULL, `imagen_banner` = NULL, `mp_expires_in` = NULL, `mp_public_key` = NULL, `pedido_minimo` = '0.00', `usuario_email` = 'restaurante2@hotmail.com', `costo_delivery` = '0.00', `dias_operacion` = NULL, `email_contacto` = NULL, `fecha_registro` = '2025-09-06T19:38:44.000Z', `horario_cierre` = NULL, `pedidos_online` = 1, `propietario_id` = NULL, `usuario_nombre` = 'Jwjwj', `mp_access_token` = NULL, `mp_last_updated` = NULL, `horario_apertura` = NULL, `mp_refresh_token` = NULL, `usuario_apellido` = 'dksksk', `usuario_telefono` = NULL, `mercadopago_active` = 0, `tiempo_entrega_max` = 60, `tiempo_entrega_min` = 30, `total_calificaciones` = 0, `calificacion_promedio` = '0.0', `datos_transferencia_cbu` = NULL, `datos_transferencia_dni` = NULL, `email_notif_nuevo_pedido` = 1, `mercadopago_access_token` = NULL, `mercadopago_collector_id` = NULL, `datos_transferencia_alias` = NULL, `email_notif_cambio_estado` = 1, `datos_transferencia_titular` = NULL, `email` = 'restaurante2@hotmail.com', `activo` = 1, `nombre` = 'U53rnykjrmebybey', '2025-09-06 16:43:21.000', '192.168.0.106');

-- Table: calificaciones
INSERT INTO calificaciones (id, pedido_id, cliente_id, restaurante_id, repartidor_id, calificacion_restaurante, calificacion_repartidor, comentario_restaurante, comentario_repartidor, fecha_calificacion, puede_resenar, resena_dejada, fecha_limite_resena, fecha_resena) VALUES 
(1, 1, 2, 1, 9, 5, 5, 'Excelente calidad de la carne, llegó caliente y en perfecto estado', 'Muy puntual y amable', '2025-09-06 16:20:03.000', 1, 0, NULL, NULL),
(2, 2, 3, 2, 10, 4, 4, 'Buena pizza, llegó a tiempo', 'Amable y rápido', '2025-09-06 16:20:03.000', 1, 0, NULL, NULL),
(3, 3, 2, 3, 9, 4, 5, 'El lomito estaba muy rico', 'Excelente servicio', '2025-09-06 16:20:03.000', 1, 0, NULL, NULL);

-- Table: carrito
-- Table: carrito_opciones
-- Table: categorias_productos
INSERT INTO categorias_productos (id, restaurante_id, nombre, descripcion, orden_display, activa) VALUES 
(1, NULL, 'Pizzas', 'Variedad de pizzas para todos los gustos', 10, 1),
(2, NULL, 'Empanadas', 'Las mejores empanadas de la ciudad', 20, 1),
(3, NULL, 'Hamburguesas', 'Deliciosas hamburguesas y combos', 25, 1),
(4, NULL, 'Sandwiches', 'Deliciosos sandwiches y wraps', 30, 1),
(5, NULL, 'Otros', 'Todo tipo de comidas variadas', 40, 1);

-- Table: categorias_restaurantes
INSERT INTO categorias_restaurantes (id, nombre, descripcion, imagen, activa, orden_display) VALUES 
(5, 'Otros', 'Todo tipo de comidas variadas', 'others.jpg', 1, 5),
(6, 'Bebidas', 'Bebidas y refrescos', 'drink-category.jpg', 1, 7),
(7, 'Postres', 'Dulces y postres caseros', 'dessert-category.jpg', 1, 8),
(10, 'Hamburguesas', 'Las mejores hamburguesas artesanales', 'hamburger-category.jpg', 1, 6),
(11, 'Empanadas', 'Las mejores empanadas de la ciudad', 'empanadas.jpg', 1, 1),
(12, 'Pizzas', 'Variedad de pizzas para todos los gustos', 'pizza.jpg', 1, 2),
(13, 'Sandwiches', 'Deliciosos sandwiches y wraps', 'sandwich.jpg', 1, 3),
(14, 'Pastas', 'Pastas frescas y salsas caseras', 'pastas.jpg', 1, 4),
(16, 'Panadería', 'Pan fresco, pasteles y más.', '/images/categories/panaderia.png', 1, 5),
(17, 'Empanadas', 'Las mejores empanadas de la ciudad', 'empanadas.jpg', 1, 1),
(18, 'Pizzas', 'Variedad de pizzas para todos los gustos', 'pizza.jpg', 1, 2),
(19, 'Sandwiches', 'Deliciosos sandwiches y wraps', 'sandwich.jpg', 1, 3),
(20, 'Pastas', 'Pastas frescas y salsas caseras', 'pastas.jpg', 1, 4),
(21, 'Otros', 'Todo tipo de comidas variadas', 'others.jpg', 1, 5),
(22, 'Empanadas', 'Las mejores empanadas de la ciudad', 'empanadas.jpg', 1, 1),
(23, 'Pizzas', 'Variedad de pizzas para todos los gustos', 'pizza.jpg', 1, 2),
(24, 'Sandwiches', 'Deliciosos sandwiches y wraps', 'sandwich.jpg', 1, 3),
(25, 'Pastas', 'Pastas frescas y salsas caseras', 'pastas.jpg', 1, 4),
(26, 'Otros', 'Todo tipo de comidas variadas', 'others.jpg', 1, 5);

-- Table: cobros_semanales
INSERT INTO cobros_semanales (id, restaurante_id, semana_inicio, semana_fin, ventas_brutas, porcentaje_comision, monto_comision, estado, fecha_vencimiento, fecha_pago, fecha_creacion, fecha_actualizacion, notas) VALUES 
(1, 1, '2024-01-01 00:00:00.000', '2024-01-07 00:00:00.000', '14371.00', '10.00', '1437.10', 'pagado', '2024-01-14 00:00:00.000', NULL, '2025-06-16 14:15:30.000', '2025-06-16 14:15:30.000', 'Pagado a tiempo'),
(2, 2, '2024-01-01 00:00:00.000', '2024-01-07 00:00:00.000', '17401.75', '10.00', '1740.18', 'pagado', '2024-01-14 00:00:00.000', NULL, '2025-06-16 14:15:30.000', '2025-06-16 14:15:30.000', 'Pagado a tiempo'),
(3, 3, '2024-01-01 00:00:00.000', '2024-01-07 00:00:00.000', '12730.50', '10.00', '1273.05', 'pagado', '2024-01-14 00:00:00.000', '2025-06-16 15:52:41.000', '2025-06-16 14:15:30.000', '2025-06-16 15:52:41.000', NULL),
(4, 4, '2024-01-01 00:00:00.000', '2024-01-07 00:00:00.000', '2000.00', '10.00', '200.00', 'pagado', '2024-01-14 00:00:00.000', '2025-07-23 22:08:54.000', '2025-06-16 14:15:30.000', '2025-07-23 22:08:54.000', NULL),
(5, 5, '2024-01-01 00:00:00.000', '2024-01-07 00:00:00.000', '1700.00', '10.00', '170.00', 'pagado', '2024-01-14 00:00:00.000', '2025-07-23 22:09:04.000', '2025-06-16 14:15:30.000', '2025-07-23 22:09:04.000', NULL),
(6, 1, '2025-06-09 00:00:00.000', '2025-06-16 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-06-23 00:00:00.000', NULL, '2025-06-16 19:05:24.000', '2025-06-16 19:05:24.000', NULL),
(7, 1, '2025-06-12 00:00:00.000', '2025-06-19 00:00:00.000', '8590.40', '10.00', '859.04', 'pagado', '2025-06-26 00:00:00.000', '2025-06-18 23:13:09.000', '2025-06-18 22:40:57.000', '2025-06-18 23:13:09.000', NULL),
(9, 9, '2025-06-22 00:00:00.000', '2025-06-29 00:00:00.000', '10870.00', '10.00', '1087.00', 'pagado', '2025-07-06 00:00:00.000', '2025-07-23 22:08:24.000', '2025-06-29 12:36:20.000', '2025-07-23 22:08:24.000', NULL),
(10, 11, '2025-07-08 00:00:00.000', '2025-07-15 00:00:00.000', '68000.00', '10.00', '6800.00', 'pagado', '2025-07-22 00:00:00.000', '2025-07-23 22:08:19.000', '2025-07-15 00:02:34.000', '2025-07-23 22:08:19.000', NULL),
(11, 9, '2025-07-14 00:00:00.000', '2025-07-20 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-27 00:00:00.000', NULL, '2025-07-21 22:36:50.000', '2025-07-21 22:36:50.000', NULL),
(12, 9, '2025-07-19 00:00:00.000', '2025-07-22 00:00:00.000', '60000.00', '10.00', '6000.00', 'pagado', '2025-07-29 00:00:00.000', '2025-07-23 22:08:01.000', '2025-07-21 22:38:23.000', '2025-07-23 22:08:01.000', NULL),
(13, 11, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '19000.00', '10.00', '1900.00', 'pagado', '2025-07-29 00:00:00.000', '2025-07-23 22:08:13.000', '2025-07-21 22:43:11.000', '2025-07-23 22:08:13.000', NULL),
(14, 1, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-29 00:00:00.000', NULL, '2025-07-21 22:56:49.000', '2025-07-21 22:56:49.000', NULL),
(15, 2, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-29 00:00:00.000', NULL, '2025-07-21 22:56:57.000', '2025-07-21 22:56:57.000', NULL),
(16, 3, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-29 00:00:00.000', NULL, '2025-07-21 22:57:05.000', '2025-07-21 22:57:05.000', NULL),
(17, 4, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-29 00:00:00.000', NULL, '2025-07-21 22:57:12.000', '2025-07-21 22:57:12.000', NULL),
(18, 5, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-29 00:00:00.000', NULL, '2025-07-21 22:57:19.000', '2025-07-21 22:57:19.000', NULL),
(19, 8, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-29 00:00:00.000', NULL, '2025-07-21 22:57:27.000', '2025-07-21 22:57:27.000', NULL),
(20, 9, '2025-07-15 00:00:00.000', '2025-07-22 00:00:00.000', '60000.00', '10.00', '6000.00', 'pagado', '2025-07-29 00:00:00.000', '2025-07-23 22:08:09.000', '2025-07-21 22:57:35.000', '2025-07-23 22:08:09.000', NULL),
(21, 1, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '40.40', '10.00', '4.04', 'pagado', '2025-07-31 00:00:00.000', '2025-07-23 22:08:30.000', '2025-07-23 22:05:32.000', '2025-07-23 22:08:30.000', NULL),
(22, 2, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-31 00:00:00.000', NULL, '2025-07-23 22:05:38.000', '2025-07-23 22:05:38.000', NULL),
(23, 3, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-31 00:00:00.000', NULL, '2025-07-23 22:05:43.000', '2025-07-23 22:05:43.000', NULL),
(24, 4, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-31 00:00:00.000', NULL, '2025-07-23 22:05:48.000', '2025-07-23 22:05:48.000', NULL),
(25, 5, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-31 00:00:00.000', NULL, '2025-07-23 22:05:53.000', '2025-07-23 22:05:53.000', NULL),
(26, 8, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '0.00', '10.00', '0.00', 'pendiente', '2025-07-31 00:00:00.000', NULL, '2025-07-23 22:05:58.000', '2025-07-23 22:05:58.000', NULL),
(27, 9, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '81870.00', '10.00', '8187.00', 'pagado', '2025-07-31 00:00:00.000', '2025-07-23 22:08:35.000', '2025-07-23 22:06:03.000', '2025-07-23 22:08:35.000', NULL),
(28, 11, '2025-03-01 00:00:00.000', '2025-07-24 00:00:00.000', '48000.00', '10.00', '4800.00', 'pagado', '2025-07-31 00:00:00.000', '2025-07-23 22:08:38.000', '2025-07-23 22:06:08.000', '2025-07-23 22:08:38.000', NULL),
(29, 11, '2025-07-17 00:00:00.000', '2025-07-24 00:00:00.000', '66000.00', '10.00', '6600.00', 'pendiente', '2025-07-31 00:00:00.000', NULL, '2025-07-24 13:19:40.000', '2025-07-24 13:19:40.000', NULL),
(30, 11, '2025-08-25 00:00:00.000', '2025-09-01 00:00:00.000', '28044.00', '10.00', '2804.40', 'pendiente', '2025-09-06 00:00:00.000', NULL, '2025-08-30 17:04:49.000', '2025-08-30 17:04:49.000', 'Pedidos: 7 | Confirmados: $18.297 | Pendientes: $9.747');

-- Table: comisiones
INSERT INTO comisiones (id, repartidor_id, pedido_id, monto, estado, fecha_creacion, fecha_pago) VALUES 
(1, 6, 74, '200.00', 'pendiente', '2025-09-06 14:32:47.000', NULL),
(2, 6, 76, '200.00', 'pendiente', '2025-09-06 14:32:56.000', NULL);

-- Table: comprobantes_pago
INSERT INTO comprobantes_pago (id, cobro_semanal_id, restaurante_id, archivo_comprobante, metodo_pago, referencia_pago, monto_pagado, fecha_pago_declarada, estado, fecha_subida, fecha_revision, admin_revisor_id, comentarios_admin, comentarios_restaurante) VALUES 
(1, 1, 1, 'comprobante-1705123456789.jpg', 'transferencia', 'TRANS001234567', '1437.10', '2024-01-13 00:00:00.000', 'aprobado', '2024-01-13 10:30:00.000', '2024-01-13 14:20:00.000', 1, 'Comprobante válido, pago confirmado', 'Transferencia realizada desde cuenta empresarial'),
(2, 7, 1, 'comprobante-1750298486014-775823232.pdf', 'transferencia', NULL, NULL, '2025-06-19 00:00:00.000', 'pendiente', '2025-06-18 23:01:26.000', NULL, NULL, NULL, NULL),
(3, 7, 1, 'comprobante-1750298627494-638306121.pdf', 'transferencia', NULL, NULL, '2025-06-19 00:00:00.000', 'pendiente', '2025-06-18 23:03:47.000', NULL, NULL, NULL, NULL),
(4, 7, 1, 'comprobante-1750298810111-189586013.pdf', 'deposito', NULL, NULL, '2025-06-19 00:00:00.000', 'aprobado', '2025-06-18 23:06:50.000', '2025-06-18 23:13:09.000', 1, NULL, NULL),
(5, 13, 11, 'comprobante-1753149216452-214657710.png', 'mercadopago', NULL, '1900.00', '2025-07-22 00:00:00.000', 'aprobado', '2025-07-21 22:53:36.000', '2025-07-21 22:56:08.000', 1, NULL, NULL),
(6, 29, 11, 'comprobante-1753501416354-297037419.png', 'mercadopago', NULL, '6600.00', '2025-07-26 00:00:00.000', 'pendiente', '2025-07-26 00:43:44.000', NULL, NULL, NULL, NULL),
(7, 1, 1, 'comprobante-1705123456789.jpg', 'transferencia', 'TRANS001234567', '1437.10', '2024-01-13 00:00:00.000', 'aprobado', '2024-01-13 10:30:00.000', '2024-01-13 14:20:00.000', 1, 'Comprobante válido, pago confirmado', 'Transferencia realizada desde cuenta empresarial'),
(8, 1, 1, 'comprobante-1705123456789.jpg', 'transferencia', 'TRANS001234567', '1437.10', '2024-01-13 00:00:00.000', 'aprobado', '2024-01-13 10:30:00.000', '2024-01-13 14:20:00.000', 1, 'Comprobante válido, pago confirmado', 'Transferencia realizada desde cuenta empresarial');

-- Table: configuracion
INSERT INTO configuracion (id, sitio_web, comision, tiempo_preparacion, created_at, updated_at) VALUES 
(1, 'http://localhost:3000', '10.00', 30, '2025-07-12 17:12:12.000', '2025-07-12 17:12:12.000');

-- Table: configuraciones
INSERT INTO configuraciones (id, clave, valor, descripcion, tipo, fecha_actualizacion) VALUES 
(1, 'app_name', 'A la Mesa', 'Nombre de la aplicación', 'string', '2025-09-06 16:20:03.000'),
(2, 'delivery_radius_km', '15', 'Radio de delivery en kilómetros', 'number', '2025-09-06 16:20:03.000'),
(3, 'min_order_amount', '10.00', 'Monto mínimo de pedido general', 'number', '2025-09-06 16:20:03.000'),
(4, 'tax_percentage', '21.00', 'Porcentaje de impuestos (IVA)', 'number', '2025-09-06 16:20:03.000'),
(5, 'service_fee_percentage', '5.00', 'Comisión de servicio', 'number', '2025-09-06 16:20:03.000'),
(6, 'max_delivery_time', '90', 'Tiempo máximo de delivery en minutos', 'number', '2025-09-06 16:20:03.000'),
(7, 'support_phone', '+5411-0800-MESA', 'Teléfono de soporte', 'string', '2025-09-06 16:20:03.000'),
(8, 'support_email', 'soporte@alamesa.com', 'Email de soporte', 'string', '2025-09-06 16:20:03.000'),
(9, 'app_version', '1.0.0', 'Versión actual de la aplicación', 'string', '2025-09-06 16:20:03.000'),
(10, 'comision_porcentaje', '10.00', 'Porcentaje de comisión sobre ventas brutas', 'number', '2025-09-06 16:20:03.000'),
(11, 'dias_vencimiento_cobro', '7', 'Días para vencimiento de cobros desde fin de semana', 'number', '2025-09-06 16:20:03.000'),
(12, 'metodos_pago_permitidos', '[\"transferencia\",\"deposito\",\"mercadopago\",\"efectivo\",\"otro\"]', 'Métodos de pago permitidos para restaurantes', 'json', '2025-09-06 16:20:03.000'),
(13, 'moneda_sistema', 'ARS', 'Moneda del sistema', 'string', '2025-09-06 16:20:03.000'),
(14, 'email_admin_notificaciones', 'admin@alamesa.com', 'Email para notificaciones administrativas', 'string', '2025-09-06 16:20:03.000'),
(15, 'generar_cobros_automatico', 'true', 'Generar cobros automáticamente cada lunes', 'boolean', '2025-09-06 16:20:03.000'),
(16, 'tamaño_maximo_comprobante', '10485760', 'Tamaño máximo de comprobante en bytes (10MB)', 'number', '2025-09-06 16:20:03.000');

-- Table: cupones
INSERT INTO cupones (id, codigo, descripcion, tipo, valor, pedido_minimo, limite_uso, usos_actuales, fecha_inicio, fecha_fin, activo, aplicable_a, restaurante_id, fecha_creacion) VALUES 
(1, 'BIENVENIDO20', 'Descuento de bienvenida del 20%', 'porcentaje', '20.00', '15.00', 100, 0, '2024-01-01 00:00:00.000', '2024-12-31 00:00:00.000', 1, 'todos', NULL, '2025-09-06 16:20:03.000'),
(2, 'DELIVERY5', 'Descuento fijo de $5 en delivery', 'monto_fijo', '5.00', '20.00', NULL, 0, '2024-01-01 00:00:00.000', '2024-12-31 00:00:00.000', 1, 'todos', NULL, '2025-09-06 16:20:03.000'),
(3, 'PASTA10', 'Descuento del 10% en La Nonna Trattoria', 'porcentaje', '10.00', '25.00', 50, 0, '2024-01-01 00:00:00.000', '2024-12-31 00:00:00.000', 1, 'restaurante_especifico', NULL, '2025-09-06 16:20:03.000');

-- Table: direcciones
INSERT INTO direcciones (id, usuario_id, nombre, direccion, ciudad, codigo_postal, latitud, longitud, es_principal, activa, created_at) VALUES 
(1, 2, 'Casa', 'Av. Libertador 1234, Apartamento 5B', 'Buenos Aires', NULL, '-34.60372200', '-58.38159200', 1, 1, '2025-09-06 16:20:03.000'),
(2, 3, 'Trabajo', 'Av. Corrientes 5678', 'Buenos Aires', NULL, '-34.60394500', '-58.38123400', 0, 1, '2025-09-06 16:20:03.000'),
(3, 3, 'Casa', 'Calle Florida 9876', 'Buenos Aires', NULL, '-34.60472200', '-58.38259200', 1, 1, '2025-09-06 16:20:03.000');

-- Table: drivers
INSERT INTO drivers (id, user_id, restaurante_id, status, current_latitude, current_longitude, vehicle_type, created_at, updated_at, request_status, last_lat, last_lng) VALUES 
(1, 30, 11, 'offline', NULL, NULL, 'moto', '2025-07-28 00:21:38.000', '2025-07-28 00:21:38.000', 'independent', NULL, NULL),
(2, 32, 11, 'offline', NULL, NULL, 'moto', '2025-09-01 23:52:09.000', '2025-09-01 23:52:09.000', 'independent', NULL, NULL),
(3, 34, NULL, 'offline', NULL, NULL, 'moto', '2025-09-04 00:03:46.000', '2025-09-04 00:03:46.000', 'independent', NULL, NULL),
(4, 35, NULL, 'available', '-33.89690000', '-61.09930000', 'moto', '2025-09-04 00:05:05.000', '2025-09-04 13:42:44.000', 'independent', NULL, NULL),
(5, 36, 11, 'offline', NULL, NULL, 'auto', '2025-09-04 00:08:40.000', '2025-09-04 00:09:00.000', 'accepted', NULL, NULL),
(6, 37, 11, 'available', '-33.89690000', '-61.09930000', 'moto', '2025-09-06 14:05:43.000', '2025-09-06 14:14:40.000', 'accepted', NULL, NULL),
(7, 9, NULL, 'available', NULL, NULL, NULL, '2025-09-06 15:40:48.000', '2025-09-06 15:40:48.000', 'independent', NULL, NULL),
(8, 10, NULL, 'available', NULL, NULL, NULL, '2025-09-06 15:40:48.000', '2025-09-06 15:40:48.000', 'independent', NULL, NULL),
(9, 26, NULL, 'available', NULL, NULL, 'moto', '2025-09-06 15:47:37.000', '2025-09-06 15:47:37.000', 'independent', NULL, NULL),
(10, 29, 7, 'offline', NULL, NULL, 'moto', '2025-09-06 16:02:42.000', '2025-09-06 16:04:57.000', 'accepted', NULL, NULL),
(11, 14, 7, 'available', '-33.89690000', '-61.09930000', 'moto', '2025-09-06 16:52:26.000', '2025-09-06 16:53:41.000', 'pending', NULL, NULL);

-- Table: favoritos
INSERT INTO favoritos (id, cliente_id, restaurante_id, fecha_agregado) VALUES 
(1, 2, 1, '2025-09-06 16:20:03.000'),
(2, 2, 2, '2025-09-06 16:20:03.000'),
(3, 3, 2, '2025-09-06 16:20:03.000'),
(4, 3, 3, '2025-09-06 16:20:03.000'),
(5, 2, 4, '2025-09-06 16:20:03.000'),
(6, 3, 5, '2025-09-06 16:20:03.000');

-- Table: horarios_trabajo_repartidor
-- Table: item_opciones_seleccionadas
-- Table: items_pedido
INSERT INTO items_pedido (id, pedido_id, producto_id, cantidad, precio_unitario, subtotal, notas_especiales) VALUES 
(1, 1, 1, 1, '2.50', '2.50', NULL),
(2, 1, 3, 1, '2.30', '2.30', NULL),
(3, 2, 5, 1, '15.00', '15.00', NULL),
(4, 3, 7, 1, '12.00', '12.00', NULL),
(5, 4, 8, 1, '18.00', '18.00', NULL),
(6, 4, 10, 1, '9.00', '9.00', NULL),
(7, 5, 11, 1, '14.00', '14.00', NULL),
(8, 5, 13, 2, '3.00', '6.00', NULL),
(9, 10, 18, 1, '50.00', '50.00', NULL);

-- Table: mensajes
-- Table: mensajes_pedido
INSERT INTO mensajes_pedido (id, pedido_id, remitente_id, remitente_tipo, mensaje, fecha_envio) VALUES 
(7, 9, 2, 'cliente', 'rwerew', '2025-06-30 23:35:52.000'),
(8, 9, 2, 'cliente', 'qweqw', '2025-06-30 23:35:54.000'),
(9, 9, 2, 'cliente', 'gdfgdf', '2025-06-30 23:37:11.000'),
(10, 9, 2, 'cliente', 'ewrew', '2025-06-30 23:43:07.000'),
(11, 9, 2, 'cliente', 'fwerwer', '2025-06-30 23:44:26.000'),
(12, 9, 2, 'cliente', 'ewrwe', '2025-06-30 23:45:05.000'),
(13, 9, 2, 'cliente', 'treert', '2025-06-30 23:45:07.000'),
(14, 9, 2, 'cliente', 'eqwqw', '2025-06-30 23:45:10.000'),
(15, 9, 2, 'cliente', 'terteter', '2025-06-30 23:45:11.000'),
(16, 9, 2, 'cliente', 'rwe', '2025-06-30 23:46:29.000'),
(17, 9, 2, 'cliente', 'qweew', '2025-06-30 23:46:31.000'),
(18, 9, 2, 'cliente', 'eqweqw', '2025-06-30 23:46:45.000'),
(19, 9, 2, 'cliente', 'rewrewrwe', '2025-06-30 23:47:55.000'),
(20, 9, 2, 'cliente', 'eqeqw', '2025-06-30 23:47:58.000'),
(21, 9, 2, 'cliente', '312321', '2025-06-30 23:50:19.000'),
(22, 9, 2, 'cliente', '4234334', '2025-06-30 23:50:22.000'),
(23, 9, 2, 'cliente', '543534', '2025-06-30 23:50:25.000'),
(24, 9, 2, 'cliente', '1321', '2025-06-30 23:51:55.000'),
(25, 9, 2, 'cliente', 'ewqewew', '2025-06-30 23:51:59.000'),
(26, 9, 2, 'cliente', 'eqweq', '2025-06-30 23:52:05.000'),
(27, 9, 2, 'cliente', 'eqweqw', '2025-06-30 23:55:06.000'),
(28, 9, 14, 'restaurante', 'ewqeeqw', '2025-06-30 23:59:11.000'),
(29, 9, 14, 'restaurante', 'eqwew', '2025-06-30 23:59:15.000'),
(30, 9, 14, 'restaurante', 'eqweqw', '2025-07-01 00:01:21.000'),
(31, 9, 2, 'cliente', '424', '2025-07-01 00:01:29.000'),
(32, 9, 2, 'cliente', '4325252', '2025-07-01 00:01:34.000'),
(33, 9, 14, 'restaurante', '432434', '2025-07-01 00:01:42.000'),
(34, 9, 14, 'restaurante', 'hola', '2025-07-09 00:17:21.000'),
(35, 27, 14, 'restaurante', 'hola', '2025-07-21 14:58:49.000'),
(36, 35, 15, 'cliente', 'fdg', '2025-07-23 21:02:46.000'),
(37, 34, 15, 'cliente', 'Rhrhrh', '2025-07-23 21:19:00.000'),
(38, 24, 27, 'restaurante', 'saddas', '2025-07-23 21:52:30.000'),
(39, 36, 27, 'restaurante', 'qwewq', '2025-07-23 22:42:44.000'),
(40, 65, 15, 'cliente', 'rwerew', '2025-07-26 00:14:34.000'),
(41, 66, 15, 'cliente', 'fdsfsd', '2025-07-26 00:22:03.000'),
(42, 66, 15, 'cliente', 'bdgdgf', '2025-07-26 00:22:12.000'),
(43, 66, 15, 'cliente', 'hola', '2025-07-26 00:29:24.000'),
(44, 66, 15, 'cliente', 'eqwew', '2025-07-26 00:33:08.000'),
(45, 66, 15, 'cliente', 'fdsfsd', '2025-07-26 00:33:13.000'),
(46, 66, 15, 'cliente', 'ewqeweq', '2025-07-26 00:33:18.000'),
(47, 66, 15, 'cliente', 'hola', '2025-07-26 00:37:35.000'),
(48, 66, 15, 'cliente', 'gfdgf', '2025-07-26 00:37:46.000'),
(49, 67, 15, 'cliente', 'hola', '2025-07-27 15:22:10.000'),
(50, 68, 15, 'cliente', 'hola', '2025-07-27 15:34:05.000'),
(51, 68, 15, 'cliente', 'que tal', '2025-07-27 15:34:11.000'),
(52, 68, 15, 'cliente', 'bien', '2025-07-27 15:34:23.000'),
(53, 68, 27, 'restaurante', 'hola', '2025-07-27 15:35:02.000'),
(54, 68, 15, 'cliente', 'esoo', '2025-07-27 15:35:11.000'),
(55, 69, 15, 'cliente', 'Hola', '2025-07-27 19:02:02.000'),
(56, 70, 15, 'cliente', 'Ksis', '2025-07-28 00:04:36.000'),
(57, 70, 15, 'cliente', 'Huhhh', '2025-07-28 00:04:40.000'),
(58, 76, 27, 'restaurante', 'ewqewq', '2025-07-28 17:49:59.000'),
(59, 76, 27, 'restaurante', 'weqe', '2025-07-28 17:50:10.000'),
(60, 76, 27, 'restaurante', 'qqqq', '2025-07-28 17:51:23.000'),
(61, 76, 27, 'restaurante', 'wwww', '2025-07-28 17:51:24.000'),
(62, 76, 27, 'restaurante', 'hola', '2025-07-28 17:51:26.000'),
(63, 77, 27, 'restaurante', 'hola', '2025-07-28 17:52:05.000'),
(64, 77, 27, 'restaurante', 'qqq', '2025-07-28 17:52:41.000'),
(65, 77, 27, 'restaurante', 'wewqw', '2025-07-28 17:52:49.000'),
(66, 77, 27, 'restaurante', '3242', '2025-07-28 17:52:50.000'),
(67, 77, 27, 'restaurante', '111', '2025-07-28 17:52:51.000'),
(68, 77, 27, 'restaurante', 'hh', '2025-07-28 17:52:53.000'),
(69, 77, 27, 'restaurante', 'eqwewq', '2025-07-28 17:56:57.000'),
(70, 77, 15, 'cliente', 'hola', '2025-07-28 18:45:12.000'),
(71, 77, 15, 'cliente', 'eqwewqwqe', '2025-07-28 18:46:00.000'),
(72, 77, 15, 'cliente', 'ewqewwe', '2025-07-28 18:53:16.000'),
(73, 77, 15, 'cliente', '123', '2025-07-28 18:53:39.000'),
(74, 77, 15, 'cliente', 'qqqqqqq', '2025-07-28 19:10:24.000'),
(75, 77, 15, 'cliente', 'wwww', '2025-07-28 19:10:27.000'),
(76, 77, 15, 'cliente', '111', '2025-07-28 19:11:19.000'),
(77, 77, 15, 'cliente', '32322323', '2025-07-28 19:11:23.000'),
(78, 77, 15, 'cliente', '2131233211', '2025-07-28 19:11:26.000'),
(79, 77, 15, 'cliente', 'weqeweq', '2025-07-28 19:11:28.000'),
(80, 77, 15, 'cliente', 'ewqewq', '2025-07-28 19:17:49.000'),
(81, 77, 15, 'cliente', 'dsads', '2025-07-28 19:17:51.000'),
(82, 77, 15, 'cliente', '0000', '2025-07-28 19:29:51.000'),
(83, 77, 15, 'cliente', '888', '2025-07-28 19:29:59.000'),
(84, 77, 15, 'cliente', '444444', '2025-07-28 19:30:03.000'),
(85, 77, 15, 'cliente', '4weqewqewq', '2025-07-28 19:32:26.000'),
(86, 77, 27, 'restaurante', 'ewqew', '2025-07-28 20:08:01.000'),
(87, 77, 27, 'restaurante', '312312', '2025-07-28 20:08:06.000'),
(88, 77, 27, 'restaurante', 'dsadsasa', '2025-07-28 20:08:12.000'),
(89, 77, 15, 'cliente', 'weqewq', '2025-07-28 20:08:56.000'),
(90, 77, 27, 'restaurante', 'ewqeqwewqeqwrqwrqwrewr', '2025-07-28 20:09:03.000'),
(91, 79, 15, 'cliente', 'Hola', '2025-07-28 23:37:51.000'),
(92, 80, 15, 'cliente', 'Que tal', '2025-07-28 23:49:03.000'),
(93, 79, 27, 'restaurante', 'Q onda', '2025-07-28 23:57:41.000'),
(94, 79, 27, 'restaurante', 'Su pedido esta preparandose', '2025-07-28 23:57:54.000'),
(95, 79, 15, 'cliente', 'Joya', '2025-07-28 23:58:05.000'),
(96, 81, 30, 'repartidor', 'Aue ondaaa', '2025-08-19 19:59:26.000'),
(97, 81, 27, 'restaurante', 'Esoo', '2025-08-19 20:01:30.000'),
(98, 89, 15, 'cliente', 'sadsa', '2025-08-21 23:25:30.000'),
(99, 89, 15, 'cliente', 'wqeeqwew', '2025-08-21 23:37:37.000'),
(100, 89, 27, 'restaurante', 'esaa', '2025-08-25 00:03:00.000'),
(101, 93, 15, 'cliente', 'ji', '2025-08-28 00:01:39.000'),
(102, 99, 27, 'restaurante', 'Jdkd', '2025-08-30 19:51:56.000');

-- Table: migrations
INSERT INTO migrations (id, name, applied_at) VALUES 
(1, '20250716_remove_auto_review_trigger.sql', '2025-07-24 13:58:07.000'),
(2, '20250722_update_pedidos_status_columns.sql', '2025-07-24 13:58:07.000'),
(3, '20250724_add_rol_to_usuarios.sql', '2025-07-24 13:58:22.000'),
(6, '20250724_add_mp_credentials_to_restaurantes.sql', '2025-07-24 14:05:20.000'),
(7, '20250724_add_mp_public_key_to_restaurantes.sql', '2025-07-24 23:04:32.000'),
(8, '20250725_add_payment_status_columns_to_pedidos.sql', '2025-07-24 23:07:01.000'),
(9, '20250724_create_migrations_table.sql', '2025-07-28 00:08:52.000'),
(10, '20250727_add_delivery_system_tables.sql', '2025-07-28 00:09:41.000'),
(11, '20250727_increase_pedidos_estado_length.sql', '2025-07-28 00:09:51.000'),
(12, '20250727_update_pedidos_estado_enum.sql', '2025-07-28 00:09:51.000'),
(13, '20250728_create_mensajes_table.sql', '2025-07-28 00:29:23.000'),
(14, '20250821_add_estado_pago_to_pedidos.sql', '2025-08-26 17:11:22.000'),
(15, '20250821_add_missing_payment_columns_to_pedidos.sql', '2025-08-26 17:11:22.000'),
(16, '20250826_add_pago_cancelado_to_pedidos.sql', '2025-08-26 17:11:23.000'),
(17, '20250826_add_recibir_notificaciones_to_usuarios.sql', '2025-08-26 18:46:45.000'),
(18, '20250830_add_email_notification_prefs.sql', '2025-08-31 13:07:31.000'),
(19, '20250831_add_driver_payout_to_pedidos.sql', '2025-08-31 13:07:31.000'),
(20, '20250831_add_restaurant_id_and_request_status_to_drivers.sql', '2025-08-31 17:19:06.000');

-- Table: notificaciones_sistema
INSERT INTO notificaciones_sistema (id, usuario_id, tipo, titulo, mensaje, leida, url_accion, fecha_creacion, fecha_leida) VALUES 
(1, 4, 'nuevo_cobro', 'Nuevo cobro generado', 'Se ha generado un nuevo cobro por $1387.23 correspondiente a la semana del 08-14 enero. Vencimiento: 21 enero 2024.', 0, '/dashboard/cobros', '2024-01-15 08:30:00.000', NULL),
(2, 4, 'nuevo_cobro', 'Nuevo cobro generado', 'Se ha generado un nuevo cobro por $1387.23 correspondiente a la semana del 08-14 enero. Vencimiento: 21 enero 2024.', 0, '/dashboard/cobros', '2024-01-15 08:30:00.000', NULL),
(3, 4, 'nuevo_cobro', 'Nuevo cobro generado', 'Se ha generado un nuevo cobro por $1387.23 correspondiente a la semana del 08-14 enero. Vencimiento: 21 enero 2024.', 0, '/dashboard/cobros', '2024-01-15 08:30:00.000', NULL);

-- Table: opciones_productos
INSERT INTO opciones_productos (id, producto_id, nombre, tipo, requerido, orden_display) VALUES 
(1, 5, 'Tamaño', 'radio', 1, 1),
(2, 6, 'Tamaño', 'radio', 1, 1),
(3, 7, 'Tamaño', 'radio', 1, 1),
(4, 8, 'Tipo de Pasta', 'radio', 1, 1);

-- Table: payment_preferences
-- Table: payments
-- Table: pedidos
INSERT INTO pedidos (id, numero_pedido, cliente_id, restaurante_id, repartidor_id, direccion_entrega, latitud_entrega, pickup_latitude, pickup_longitude, longitud_entrega, subtotal, costo_delivery, impuestos, descuento, total, estado, delivery_status, metodo_pago, estado_pago, mp_payment_id, mp_status, mp_status_detail, notas_especiales, tiempo_estimado, fecha_pedido, assigned_at, picked_up_at, delivered_at, fecha_confirmacion, fecha_preparando, fecha_en_camino, fecha_entrega, motivo_cancelacion, comprobante_pago_url, mercadopago_preference_id, mercadopago_payment_id, fecha_pago, driver_payout_amount, cliente_lat, cliente_lng) VALUES 
(1, 'ALM-2024-001', 2, 1, 9, 'Av. Libertador 1234, Apartamento 5B', '-34.60372200', NULL, NULL, '-58.38159200', '35.90', '4.50', '0.00', '0.00', '40.40', 'entregado', 'pending_assignment', 'tarjeta', NULL, NULL, NULL, NULL, NULL, 45, '2025-09-06 16:20:03.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 'ALM-2024-002', 3, 2, 10, 'Calle Florida 9876', '-34.60472200', NULL, NULL, '-58.38259200', '21.90', '3.00', '0.00', '0.00', '24.90', 'en_camino', 'pending_assignment', 'efectivo', NULL, NULL, NULL, NULL, NULL, 25, '2025-09-06 16:20:03.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 'ALM-2024-003', 2, 3, 9, 'Av. Libertador 1234, Apartamento 5B', '-34.60372200', NULL, NULL, '-58.38159200', '28.90', '5.00', '0.00', '0.00', '33.90', 'preparando', 'pending_assignment', 'tarjeta', NULL, NULL, NULL, NULL, NULL, 30, '2025-09-06 16:20:03.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(4, 'ALM-2024-004', 3, 4, 10, 'Av. Corrientes 5678', '-34.60394500', NULL, NULL, '-58.38123400', '40.00', '4.00', '0.00', '0.00', '44.00', 'preparando', 'pending_assignment', 'mercadopago', NULL, NULL, NULL, NULL, NULL, 35, '2025-09-06 16:20:03.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(5, 'ALM-2024-005', 2, 5, 9, 'Calle Florida 9876', '-34.60472200', NULL, NULL, '-58.38259200', '25.00', '5.00', '0.00', '0.00', '30.00', 'pendiente', 'pending_assignment', 'transferencia', NULL, NULL, NULL, NULL, NULL, 40, '2025-09-06 16:20:03.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(10, '10', 11, 7, 11, 'eqweqw', '-33.89905937', NULL, NULL, '-61.10590339', '50.00', '0.00', '0.00', '0.00', '47.50', 'en_camino', 'pending_assignment', 'efectivo', NULL, NULL, NULL, NULL, NULL, NULL, '2025-09-06 16:50:39.000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- Table: platform_earnings
-- Table: productos
INSERT INTO productos (id, restaurante_id, categoria_id, nombre, descripcion, precio, imagen, ingredientes, calorias, tiempo_preparacion, disponible, destacado, descuento_porcentaje, fecha_creacion, fecha_actualizacion, precio_descuento, visible) VALUES 
(1, 1, 1, 'Empanada de Carne Frita', 'Empanada tradicional de carne frita', '2.50', '/uploads/productos/empanada-carne-frita.jpg', 'Carne, cebolla, huevo, aceitunas', 300, 15, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(2, 1, 1, 'Empanada de Carne Horno', 'Empanada tradicional de carne al horno', '2.50', '/uploads/productos/empanada-carne-horno.jpg', 'Carne, cebolla, huevo, aceitunas', 250, 20, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(3, 1, 2, 'Empanada de Jamón y Queso', 'Clásica empanada de jamón y queso', '2.30', '/uploads/productos/empanada-jamon-queso.jpg', 'Jamón, queso mozzarella', 280, 15, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(4, 1, 3, 'Empanada de Verdura', 'Empanada de acelga y salsa blanca', '2.30', '/uploads/productos/empanada-verdura.jpg', 'Acelga, salsa blanca, queso', 200, 15, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(5, 2, 4, 'Pizza Muzzarella', 'Clásica pizza con salsa de tomate y mozzarella', '15.00', '/uploads/productos/pizza-muzzarella.jpg', 'Muzzarella, salsa de tomate, orégano', 800, 20, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(6, 2, 4, 'Pizza Napolitana', 'Muzzarella, tomate en rodajas y ajo', '16.50', '/uploads/productos/pizza-napolitana.jpg', 'Muzzarella, tomate, ajo, perejil', 850, 20, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(7, 2, 5, 'Pizza Cuatro Quesos', 'Combinación de cuatro quesos especiales', '18.00', '/uploads/productos/pizza-4-quesos.jpg', 'Muzzarella, provolone, roquefort, parmesano', 950, 25, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(8, 3, 6, 'Sandwich de Jamón y Queso', 'Clásico sandwich de jamón y queso con lechuga y tomate', '8.00', '/uploads/productos/sandwich-jamon-queso.jpg', 'Jamón, queso, lechuga, tomate, pan de molde', 400, 10, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(9, 3, 7, 'Sandwich de Lomito', 'Lomito, lechuga, tomate, huevo y queso', '12.00', '/uploads/productos/sandwich-lomito.jpg', 'Lomito, lechuga, tomate, huevo, queso, pan francés', 600, 15, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(10, 4, 8, 'Spaghetti a la Bolognesa', 'Pasta casera con nuestra salsa de carne lenta', '18.00', '/uploads/productos/spaghetti-bolognesa.jpg', 'Spaghetti, carne picada, tomate, cebolla, zanahoria', 700, 20, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(11, 4, 8, 'Lasagna de Verduras', 'Capas de pasta, verduras y bechamel', '20.00', '/uploads/productos/lasagna-verduras.jpg', 'Pasta, espinaca, acelga, ricota, bechamel', 850, 25, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(12, 4, 9, 'Salsa Pesto Genovese', 'Salsa fresca de albahaca, piñones y parmesano', '5.00', '/uploads/productos/salsa-pesto.jpg', 'Albahaca, piñones, parmesano, ajo, aceite de oliva', 300, 5, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(13, 4, 10, 'Tiramisú Casero', 'El clásico postre italiano con café y mascarpone', '9.00', '/uploads/productos/tiramisu.jpg', 'Vainillas, café, mascarpone, huevos, cacao', 450, 10, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(14, 5, 11, 'Milanesa con Papas Fritas', 'Clásica milanesa de ternera con guarnición', '14.00', '/uploads/productos/milanesa-fritas.jpg', 'Milanesa de ternera, papas, huevo, pan rallado', 900, 20, 1, 1, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(15, 5, 11, 'Ensalada Caesar con Pollo', 'Ensalada fresca con pollo a la parrilla', '12.00', '/uploads/productos/ensalada-caesar-pollo.jpg', 'Lechuga, pollo, crutones, parmesano, aderezo Caesar', 400, 15, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(16, 5, 12, 'Porción de Papas Fritas', 'Crujientes papas fritas', '4.00', '/uploads/productos/papas-fritas.jpg', 'Papas, aceite, sal', 350, 10, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(17, 5, 13, 'Gaseosa Regular', 'Variedad de sabores (Coca-Cola, Sprite, etc.)', '3.00', '/uploads/productos/gaseosa.jpg', 'Agua carbonatada, azúcar, saborizantes', 150, 2, 1, 0, '0.00', '2025-09-06 16:20:03.000', '2025-09-06 16:20:03.000', NULL, 1),
(18, 7, 1, 'rewreerw', 'rewrew', '50.00', '/uploads/productos/producto-1757187953891-504427435.webp', NULL, NULL, NULL, 1, 0, '0.00', '2025-09-06 16:45:53.000', '2025-09-06 16:45:53.000', NULL, 1);

-- Table: push_subscriptions
INSERT INTO push_subscriptions (id, usuario_id, tipo_usuario, subscription_data, fecha_creacion, fecha_actualizacion, activo) VALUES 
(14, 14, 'restaurante', `keys` = '[object Object]', `endpoint` = 'https://fcm.googleapis.com/fcm/send/dkuZrT7X7WI:APA91bEJNrG7sIi4E2DSdJHcypAj1253pmh9XOXTj5EbohKepnRDM_rMgSfQ2UzMut5GhY8Ou_5ensFh_-qCYuwzNMcmfFwiOfYwHIohgBHEEhp4xJAB-VEBIwziuM5R93JUG9jUihMz', `expirationTime` = NULL, '2025-07-21 14:55:32.000', '2025-07-21 14:55:32.000', 1),
(15, 29, 'restaurante', `keys` = '[object Object]', `endpoint` = 'https://fcm.googleapis.com/fcm/send/dd0d099yck8:APA91bFaJhp_MmBFHBSY6XXG2aZkBDvZhgxeMR9IQQxgS7bnyDKzYGsRf7rRn-qiNnwiHtoZK1PwodkYe3ffzdlWU5OPGbxjkfVdD6P9kZPJO70POxINELFeeVuJeiR9mIrujj5Ltayu', `expirationTime` = NULL, '2025-07-26 12:29:36.000', '2025-07-26 12:29:36.000', 1),
(16, 27, 'restaurante', `keys` = '[object Object]', `endpoint` = 'https://fcm.googleapis.com/fcm/send/cP-MTTNtGbM:APA91bEvGOntVEC4la4pOikl9gBMAg5fHpl2B4nbtX3Q7-GblmXJV_SOCWZF4MVhjDqpOnjFhA2BD1n5sUkh0fGCBxXDYnJOshvRf1gDD0dX1dXEhSaQN2BMCkNOSqwrvX0XwJJXIOUn', `expirationTime` = NULL, '2025-07-28 23:59:48.000', '2025-08-25 00:17:27.000', 1);

-- Table: restaurant_commission_rates
INSERT INTO restaurant_commission_rates (id, restaurant_id, commission_percentage, active, created_at, updated_at) VALUES 
(1, 1, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(2, 2, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(3, 3, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(4, 4, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(5, 5, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(6, 8, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(7, 9, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000'),
(8, 11, '10.00', 1, '2025-07-21 15:34:25.000', '2025-07-21 15:34:25.000');

-- Table: restaurante_categorias
INSERT INTO restaurante_categorias (id, restaurante_id, categoria_id) VALUES 
(32, 1, 1),
(33, 2, 2),
(34, 3, 3),
(35, 4, 4),
(36, 5, 5);

-- Table: restaurantes
INSERT INTO restaurantes (id, usuario_id, nombre, descripcion, imagen_logo, imagen_banner, direccion, ciudad, telefono, email_contacto, latitud, longitud, horario_apertura, horario_cierre, dias_operacion, tiempo_entrega_min, tiempo_entrega_max, costo_delivery, pedido_minimo, calificacion_promedio, total_calificaciones, activo, verificado, fecha_registro, delivery, pedidos_online, datos_transferencia_cbu, datos_transferencia_alias, datos_transferencia_titular, datos_transferencia_dni, propietario_id, mercadopago_collector_id, mercadopago_access_token, mercadopago_active, mp_user_id, mp_access_token, mp_refresh_token, mp_public_key, mp_live_mode, mp_expires_in, mp_last_updated, mp_connected, email_notif_nuevo_pedido, email_notif_cambio_estado) VALUES 
(1, 4, 'La Casa de la Empanada', 'Las empanadas más ricas y variadas', 'empanada-logo.jpg', 'empanada-banner.jpg', 'Calle Falsa 123', 'Buenos Aires', '+5411-1234-5678', 'contacto@empanadas.com', '-34.60372200', '-58.38159200', '11:00:00', '23:00:00', 1, 2, 3, 4, 5, 6, 7, 30, 45, '3.00', '10.00', '4.8', 100, 1, 1, '2025-09-06 16:20:03.000', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1),
(2, 5, 'Pizza Master', 'Pizzas artesanales con el mejor sabor', 'pizzamaster-logo.jpg', 'pizzamaster-banner.jpg', 'Av. Siempre Viva 742', 'Buenos Aires', '+5411-8765-4321', 'info@pizzamaster.com', '-34.60494500', '-58.38223400', '18:00:00', '00:00:00', 1, 2, 3, 4, 5, 6, 7, 20, 35, '2.50', '15.00', '4.6', 120, 1, 1, '2025-09-06 16:20:03.000', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1),
(3, 6, 'Sandwicheria Express', 'Los sandwiches más rápidos y deliciosos', 'sandwich-logo.jpg', 'sandwich-banner.jpg', 'Rivadavia 456', 'Buenos Aires', '+5411-9876-5432', 'contacto@sandwichexpress.com', '-34.60572200', '-58.38359200', '10:00:00', '20:00:00', 2, 3, 4, 5, 6, 25, 40, '2.00', '8.00', '4.5', 90, 1, 1, '2025-09-06 16:20:03.000', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1),
(4, 7, 'La Nonna Trattoria', 'Auténtica cocina italiana con pastas caseras', 'lanonna-logo.jpg', 'lanonna-banner.jpg', 'Av. Italia 100', 'Buenos Aires', '+5411-1111-2222', 'contacto@lanonna.com', '-34.60000000', '-58.39000000', '12:00:00', '23:00:00', 1, 2, 3, 4, 5, 6, 7, 30, 45, '4.00', '20.00', '4.7', 75, 1, 1, '2025-09-06 16:20:03.000', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1),
(5, 8, 'El Rincón del Sabor', 'Variedad de platos caseros e internacionales', 'elrincon-logo.jpg', 'elrincon-banner.jpg', 'Calle Principal 500', 'Buenos Aires', '+5411-3333-4444', 'contacto@elrincon.com', '-34.61000000', '-58.40000000', '09:00:00', '21:00:00', 1, 2, 3, 4, 5, 6, 7, 35, 50, '5.00', '12.00', '4.4', 60, 1, 1, '2025-09-06 16:20:03.000', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1),
(6, 12, 'Hamburgueseria Colon', 'ewqewqewewqewqewqewqweqewq', NULL, NULL, 'la plaza', 'Colón, Bs As', '31321321321', NULL, NULL, NULL, '17:26:00', '21:26:00', 1, 2, 3, 4, 5, 6, 7, 30, 60, '0.00', '0.00', '0.0', 0, 1, 1, '2025-09-06 16:25:42.000', 0, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1),
(7, 13, 'U53rnykjrmebybey', 'Behnyenyeneyk3ykkyeky3nyebtetb', NULL, NULL, '42343', 'Colón, Bs As', '94554858845', 'restaurante2@hotmail.com', NULL, NULL, '00:00:00', '23:59:00', 1, 2, 3, 4, 5, 6, 7, 30, 60, NULL, '0.00', '0.0', 0, 1, 1, '2025-09-06 16:38:44.000', 0, 1, '43432434424', 'ewqewq.rewqeqwe', 'wqewqdsadas', '42343244', NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, 1, 1);

-- Table: sessions
INSERT INTO sessions (session_id, expires, data) VALUES 
('D9gA_qHLjKvUy8x4SOmbSfx4_mEdG1Vv', 1757274822, '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2025-09-07T19:53:41.572Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"cart\":[],\"cartTotal\":0,\"cartCount\":0,\"user\":{\"id\":14,\"nombre\":\"eqwe\",\"apellido\":\"ewqeqew\",\"email\":\"repartidor@gmail.com\",\"telefono\":\"4665446864\",\"ciudad\":\"Ciudad Autónoma de Buenos Aires\",\"direccion_principal\":null,\"tipo_usuario\":\"repartidor\",\"fecha_registro\":\"2025-09-06T19:52:26.000Z\",\"recibir_notificaciones\":1}}'),
('YIVO-a3SAcgfHo8EjyLZDM0XImh5-lAJ', 1757273951, '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2025-09-07T19:39:10.904Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"cart\":[],\"cartTotal\":0,\"cartCount\":0,\"user\":{\"id\":1,\"nombre\":\"Administrador\",\"apellido\":\"Sistema\",\"email\":\"admin@alamesa.com\",\"telefono\":\"+1234567890\",\"ciudad\":\"Buenos Aires\",\"direccion_principal\":null,\"tipo_usuario\":\"admin\",\"fecha_registro\":\"2025-09-06T19:20:03.000Z\",\"recibir_notificaciones\":1}}'),
('b-HQbVI-n79rWBub05_f2M7h3qA1ULHV', 1757274646, '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2025-09-07T19:50:45.603Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"cart\":[],\"cartTotal\":0,\"cartCount\":0,\"user\":{\"id\":11,\"nombre\":\"hamburgueseria\",\"apellido\":\"colon\",\"email\":\"tiendanexus.info@gmail.com\",\"telefono\":\"432434\",\"ciudad\":\"Colón, Bs As\",\"direccion_principal\":null,\"tipo_usuario\":\"cliente\",\"fecha_registro\":\"2025-09-06T19:24:21.000Z\",\"recibir_notificaciones\":1}}'),
('ctZnwd828wsDkGVIKycGzstNIHR4XXmd', 1757274798, '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2025-09-07T19:52:51.827Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"cart\":[],\"cartTotal\":0,\"cartCount\":0,\"user\":{\"id\":14,\"nombre\":\"eqwe\",\"apellido\":\"ewqeqew\",\"email\":\"repartidor@gmail.com\",\"telefono\":\"4665446864\",\"ciudad\":\"Ciudad Autónoma de Buenos Aires\",\"direccion_principal\":null,\"tipo_usuario\":\"repartidor\",\"fecha_registro\":\"2025-09-06T19:52:26.000Z\",\"recibir_notificaciones\":1}}'),
('h0TDJvy4-auuKai-Hvww3QjP4IJ9dohc', 1757274792, '{\"cookie\":{\"originalMaxAge\":86400000,\"expires\":\"2025-09-07T19:51:43.899Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"cart\":[],\"cartTotal\":0,\"cartCount\":0,\"user\":{\"id\":13,\"nombre\":\"Jwjwj\",\"apellido\":\"dksksk\",\"email\":\"restaurante2@hotmail.com\",\"telefono\":null,\"ciudad\":\"Colón, Bs As\",\"direccion_principal\":null,\"tipo_usuario\":\"restaurante\",\"fecha_registro\":\"2025-09-06T19:38:44.000Z\",\"recibir_notificaciones\":1,\"verificado\":1,\"email_notif_nuevo_pedido\":1},\"pedidosNoEntregados\":1}');

-- Table: uso_cupones
-- Table: usuarios
INSERT INTO usuarios (id, nombre, apellido, email, password, telefono, ciudad, direccion_principal, tipo_usuario, fecha_registro, activo, imagen_perfil, fecha_nacimiento, reset_password_token, reset_password_expires, push_banner_closed, rol, recibir_notificaciones, email_notif_nuevo_pedido, email_notif_cambio_estado) VALUES 
(1, 'Administrador', 'Sistema', 'admin@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567890', 'Buenos Aires', NULL, 'admin', '2025-09-06 16:20:03.000', 1, 'admin.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(2, 'Juan', 'Pérez', 'demo@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567891', 'Buenos Aires', NULL, 'cliente', '2025-09-06 16:20:03.000', 1, 'user1.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(3, 'María', 'González', 'maria@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567892', 'Buenos Aires', NULL, 'cliente', '2025-09-06 16:20:03.000', 1, 'user2.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(4, 'Restaurante', 'La Empanada', 'restaurante1@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567893', 'Buenos Aires', NULL, 'restaurante', '2025-09-06 16:20:03.000', 1, 'rest1.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(5, 'Pizzería', 'Master', 'restaurante2@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567894', 'Buenos Aires', NULL, 'restaurante', '2025-09-06 16:20:03.000', 1, 'rest2.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(6, 'Sandwicheria', 'Express', 'restaurante3@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567895', 'Buenos Aires', NULL, 'restaurante', '2025-09-06 16:20:03.000', 1, 'rest3.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(7, 'La', 'Nonna', 'restaurante4@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567896', 'Buenos Aires', NULL, 'restaurante', '2025-09-06 16:20:03.000', 1, 'rest4.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(8, 'El', 'Rincon', 'restaurante5@alamesa.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567897', 'Buenos Aires', NULL, 'restaurante', '2025-09-06 16:20:03.000', 1, 'rest5.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(9, 'Carlos', 'Repartidor', 'carlos.repartidor@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567898', 'Buenos Aires', NULL, 'repartidor', '2025-09-06 16:20:03.000', 1, 'delivery1.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(10, 'Ana', 'Delivery', 'ana.delivery@email.com', '$2a$12$G7AYExh29tgUcPJSSo.IwuZ5KfiZgirGvDWnxOPVOj.w8g.SxfRQ2', '+1234567899', 'Buenos Aires', NULL, 'repartidor', '2025-09-06 16:20:03.000', 1, 'delivery2.jpg', NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(11, 'hamburgueseria', 'colon', 'tiendanexus.info@gmail.com', '$2a$10$97aZEFdDwj8hWjUwQmJns.DVxrwXKH8s8yeQ282uxBo5uMXWVb8Qi', '432434', 'Colón, Bs As', NULL, 'cliente', '2025-09-06 16:24:21.000', 1, NULL, NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(12, 'esteban', 'ramirez', 'restaurante@hotmail.com', '$2a$10$OBgIYRrPB.gRvfByWyA.OegOYpMjMqt7OGoxxTFHr6x8l.59j6H8m', NULL, 'Colón, Bs As', NULL, 'restaurante', '2025-09-06 16:25:42.000', 1, NULL, NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(13, 'Jwjwj', 'dksksk', 'restaurante2@hotmail.com', '$2a$10$q0SOufGUstujd3TEShw8KOp9j/UtCIewWYJQHHnSNhgVpkKyFNPRC', NULL, 'Colón, Bs As', NULL, 'restaurante', '2025-09-06 16:38:44.000', 1, NULL, NULL, NULL, NULL, 0, 'cliente', 1, 1, 1),
(14, 'eqwe', 'ewqeqew', 'repartidor@gmail.com', '$2a$10$1Ox8brfXtLTDGe9uxYuQs.JmYF66CaU/bgHskgz0ksccjUxJy1rh6', '4665446864', 'Ciudad Autónoma de Buenos Aires', NULL, 'repartidor', '2025-09-06 16:52:26.000', 1, NULL, NULL, NULL, NULL, 0, 'cliente', 1, 1, 1);

-- Table: valores_opciones
INSERT INTO valores_opciones (id, opcion_id, nombre, precio_adicional, disponible, orden_display) VALUES 
(1, 1, 'Individual (20cm)', '0.00', 1, 1),
(2, 1, 'Mediana (30cm)', '5.00', 1, 2),
(3, 1, 'Grande (40cm)', '10.00', 1, 3),
(4, 2, 'Individual (20cm)', '0.00', 1, 1),
(5, 2, 'Mediana (30cm)', '5.00', 1, 2),
(6, 2, 'Grande (40cm)', '10.00', 1, 3),
(7, 3, 'Individual (20cm)', '0.00', 1, 1),
(8, 3, 'Mediana (30cm)', '5.00', 1, 2),
(9, 3, 'Grande (40cm)', '10.00', 1, 3),
(10, 4, 'Spaghetti', '0.00', 1, 1),
(11, 4, 'Fideos', '0.00', 1, 2),
(12, 4, 'Tallarines', '0.00', 1, 3);

-- Table: ventas_diarias
INSERT INTO ventas_diarias (id, restaurante_id, fecha, cantidad_pedidos, monto_ventas, monto_comisiones, fecha_actualizacion) VALUES 
(1, 1, '2024-01-01 00:00:00.000', 12, '1250.00', '125.00', '2025-09-06 16:20:03.000'),
(2, 1, '2024-01-02 00:00:00.000', 15, '1680.50', '168.05', '2025-09-06 16:20:03.000'),
(3, 1, '2024-01-03 00:00:00.000', 18, '2100.75', '210.08', '2025-09-06 16:20:03.000'),
(4, 2, '2024-01-01 00:00:00.000', 18, '1890.00', '189.00', '2025-09-06 16:20:03.000'),
(5, 2, '2024-01-02 00:00:00.000', 22, '2340.50', '234.05', '2025-09-06 16:20:03.000'),
(6, 2, '2024-01-03 00:00:00.000', 25, '2650.75', '265.08', '2025-09-06 16:20:03.000'),
(7, 3, '2024-01-01 00:00:00.000', 10, '1150.00', '115.00', '2025-09-06 16:20:03.000'),
(8, 3, '2024-01-02 00:00:00.000', 14, '1580.50', '158.05', '2025-09-06 16:20:03.000'),
(9, 3, '2024-01-03 00:00:00.000', 16, '1820.75', '182.08', '2025-09-06 16:20:03.000'),
(10, 4, '2024-01-01 00:00:00.000', 8, '900.00', '90.00', '2025-09-06 16:20:03.000'),
(11, 4, '2024-01-02 00:00:00.000', 10, '1100.00', '110.00', '2025-09-06 16:20:03.000'),
(12, 5, '2024-01-01 00:00:00.000', 7, '750.00', '75.00', '2025-09-06 16:20:03.000'),
(13, 5, '2024-01-02 00:00:00.000', 9, '950.00', '95.00', '2025-09-06 16:20:03.000');

