-- Migration to add comprobante_pago_url column to pedidos table
-- This column stores the URL/path of the payment receipt uploaded by the customer

ALTER TABLE pedidos ADD COLUMN comprobante_pago_url VARCHAR(500) NULL AFTER motivo_cancelacion;
