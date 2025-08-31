-- Actualizar contraseña para el usuario tiendanexus.info@gmail.com
-- Ejecutar este script en MySQL Workbench o phpMyAdmin

-- Verificar si el usuario existe
SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length 
FROM usuarios 
WHERE email LIKE '%tiendanexus%';

-- Actualizar la contraseña (el hash es para '123456')
UPDATE usuarios 
SET password = '$2a$10$bPlSRdftL3Bta4GXKQKVm.Ocpyddh6UL1MwDC1HffuGvgmNmKWy6K'
WHERE email = 'tiendanexus.info@gmail.com';

-- Verificar el cambio
SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length 
FROM usuarios 
WHERE email = 'tiendanexus.info@gmail.com';
