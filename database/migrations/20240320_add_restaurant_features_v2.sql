-- Agregar columnas de características del restaurante
ALTER TABLE restaurantes
ADD COLUMN delivery BOOLEAN DEFAULT FALSE AFTER pedido_minimo,
ADD COLUMN reservas BOOLEAN DEFAULT FALSE AFTER delivery,
ADD COLUMN pedidos_online BOOLEAN DEFAULT FALSE AFTER reservas;

-- Actualizar los restaurantes existentes para que tengan todas las características activas por defecto
UPDATE restaurantes 
SET delivery = TRUE,
    reservas = TRUE,
    pedidos_online = TRUE
WHERE activo = TRUE;

-- Verificar los cambios
SELECT 
    id,
    nombre,
    delivery,
    reservas,
    pedidos_online
FROM restaurantes
WHERE activo = TRUE; 