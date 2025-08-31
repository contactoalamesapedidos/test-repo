-- Script para actualizar la contraseña y manejar correos con/sin puntos
-- Este script actualiza la contraseña a '123456' con un hash bcrypt válido
-- Ejecutar en MySQL Workbench o phpMyAdmin

-- 1. Ver usuario actual
SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length 
FROM usuarios 
WHERE email LIKE '%tiendanexus%';

-- 2. Actualizar la contraseña (hash bcrypt para '123456' con salt 10)
--    para el correo con puntos
UPDATE usuarios 
SET password = '$2a$10$bPlSRdftL3Bta4GXKQKVm.Ocpyddh6UL1MwDC1HffuGvgmNmKWy6K',
    email = 'tiendanexus.info@gmail.com'  -- Mantenemos el formato con puntos
WHERE email = 'tiendanexus.info@gmail.com';

-- 3. Verificar el cambio
SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length 
FROM usuarios 
WHERE email IN ('tiendanexus.info@gmail.com', 'tiendanexusinfo@gmail.com');

-- 4. Crear un índice para búsquedas más rápidas (opcional)
-- ALTER TABLE usuarios ADD INDEX idx_email (email);
