ALTER TABLE pedidos
ADD COLUMN fecha_preparando TIMESTAMP NULL AFTER fecha_confirmacion,
ADD COLUMN fecha_en_camino TIMESTAMP NULL AFTER fecha_preparando,
DROP COLUMN fecha_listo;