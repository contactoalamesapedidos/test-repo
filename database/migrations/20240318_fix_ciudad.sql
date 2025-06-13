-- Primero, actualizar registros existentes que puedan tener NULL
UPDATE usuarios SET ciudad = 'Ciudad Autónoma de Buenos Aires' WHERE ciudad IS NULL OR ciudad = '';

-- Luego, modificar la columna para asegurar que tenga un valor por defecto
ALTER TABLE usuarios
MODIFY COLUMN ciudad VARCHAR(100) NOT NULL DEFAULT 'Ciudad Autónoma de Buenos Aires';

-- Verificar que no haya registros con ciudad NULL o vacía
SELECT COUNT(*) as registros_invalidos 
FROM usuarios 
WHERE ciudad IS NULL OR ciudad = ''; 