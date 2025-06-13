-- Desactivar modo seguro temporalmente
SET SQL_SAFE_UPDATES = 0;

-- Primero, desactivar todas las categorías existentes
UPDATE categorias_productos SET activa = 0;

-- Reactivar modo seguro
SET SQL_SAFE_UPDATES = 1;

-- Insertar las categorías específicas para todos los restaurantes
INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Pizza' as nombre,
    'Nuestras pizzas' as descripcion,
    1 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Empanadas' as nombre,
    'Empanadas caseras' as descripcion,
    2 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Sandwiches' as nombre,
    'Sandwiches y wraps' as descripcion,
    3 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Bebidas' as nombre,
    'Bebidas y refrescos' as descripcion,
    4 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Hamburguesas' as nombre,
    'Nuestras hamburguesas' as descripcion,
    5 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Extras' as nombre,
    'Acompañamientos y extras' as descripcion,
    6 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT DISTINCT
    r.id as restaurante_id,
    'Postres' as nombre,
    'Dulces y postres' as descripcion,
    7 as orden_display,
    1 as activa
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
GROUP BY r.id;

-- Verificar las categorías actuales
SELECT 
    r.nombre as restaurante,
    GROUP_CONCAT(DISTINCT cr.nombre) as tipo_restaurante,
    GROUP_CONCAT(DISTINCT cp.nombre ORDER BY cp.orden_display) as categorias_productos
FROM restaurantes r
JOIN restaurante_categorias rc ON r.id = rc.restaurante_id
JOIN categorias_restaurantes cr ON rc.categoria_id = cr.id
LEFT JOIN categorias_productos cp ON r.id = cp.restaurante_id AND cp.activa = 1
GROUP BY r.id, r.nombre
ORDER BY r.nombre; 