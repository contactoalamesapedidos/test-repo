-- Agregar categorías por defecto a restaurantes sin categorías
INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT 
    r.id as restaurante_id,
    'Entradas',
    'Platos para comenzar',
    1,
    1
FROM restaurantes r
LEFT JOIN categorias_productos cp ON r.id = cp.restaurante_id
WHERE cp.id IS NULL;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT 
    r.id as restaurante_id,
    'Platos Principales',
    'Nuestros platos más destacados',
    2,
    1
FROM restaurantes r
LEFT JOIN categorias_productos cp ON r.id = cp.restaurante_id
WHERE cp.id IS NULL;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT 
    r.id as restaurante_id,
    'Postres',
    'Dulces y postres',
    3,
    1
FROM restaurantes r
LEFT JOIN categorias_productos cp ON r.id = cp.restaurante_id
WHERE cp.id IS NULL;

INSERT INTO categorias_productos (restaurante_id, nombre, descripcion, orden_display, activa)
SELECT 
    r.id as restaurante_id,
    'Bebidas',
    'Bebidas y refrescos',
    4,
    1
FROM restaurantes r
LEFT JOIN categorias_productos cp ON r.id = cp.restaurante_id
WHERE cp.id IS NULL;

-- Verificar que todos los restaurantes tengan al menos una categoría
SELECT r.id, r.nombre, COUNT(cp.id) as total_categorias
FROM restaurantes r
LEFT JOIN categorias_productos cp ON r.id = cp.restaurante_id
GROUP BY r.id, r.nombre
HAVING total_categorias = 0; 