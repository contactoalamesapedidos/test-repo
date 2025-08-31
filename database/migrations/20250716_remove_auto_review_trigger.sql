-- Eliminar triggers automáticos de reseñas/calificaciones al entregar un pedido
DROP TRIGGER IF EXISTS after_pedido_entregado;
DROP TRIGGER IF EXISTS calificacion_auto;
DROP TRIGGER IF EXISTS insert_calificacion_on_entregado;
DROP TRIGGER IF EXISTS trigger_crear_calificacion;
-- Si el trigger tiene otro nombre, cámbialo aquí según corresponda 

-- Agregar campo 'visible' a la tabla productos
ALTER TABLE productos ADD COLUMN visible BOOLEAN NOT NULL DEFAULT TRUE; 