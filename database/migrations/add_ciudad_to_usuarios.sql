-- Verificar si el campo ciudad existe
SET @exist := (SELECT COUNT(*) 
               FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'usuarios' 
               AND COLUMN_NAME = 'ciudad');

-- Si no existe, añadirlo
SET @sql := IF(@exist = 0,
    'ALTER TABLE usuarios ADD COLUMN ciudad varchar(100) NOT NULL DEFAULT "Ciudad Autónoma de Buenos Aires" AFTER telefono',
    'SELECT "El campo ciudad ya existe"');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Primero actualizar registros existentes que tengan NULL
UPDATE usuarios SET ciudad = 'Ciudad Autónoma de Buenos Aires' WHERE ciudad IS NULL;

-- Luego modificar la columna para añadir el valor por defecto
ALTER TABLE usuarios 
MODIFY COLUMN ciudad varchar(100) NOT NULL 
DEFAULT 'Ciudad Autónoma de Buenos Aires';

-- Add ciudad column to usuarios table
ALTER TABLE usuarios
ADD COLUMN ciudad VARCHAR(100) NOT NULL AFTER telefono,
ADD INDEX idx_ciudad (ciudad);

-- Update existing records with a default value
UPDATE usuarios SET ciudad = 'Ciudad de Buenos Aires' WHERE ciudad IS NULL; 