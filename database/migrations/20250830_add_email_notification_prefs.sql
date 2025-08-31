-- Agrega preferencias de notificación por email para usuarios y restaurantes

-- Preferencias para usuarios (clientes y otros tipos)
ALTER TABLE usuarios 
    ADD COLUMN email_notif_nuevo_pedido BOOLEAN DEFAULT TRUE,
    ADD COLUMN email_notif_cambio_estado BOOLEAN DEFAULT TRUE;

-- Preferencias para restaurantes
ALTER TABLE restaurantes 
    ADD COLUMN email_notif_nuevo_pedido BOOLEAN DEFAULT TRUE,
    ADD COLUMN email_notif_cambio_estado BOOLEAN DEFAULT TRUE;
