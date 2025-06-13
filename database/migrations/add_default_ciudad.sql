-- Modificar la columna ciudad para agregar un valor por defecto
ALTER TABLE usuarios 
MODIFY COLUMN ciudad VARCHAR(100) NOT NULL 
DEFAULT 'Ciudad Autónoma de Buenos Aires';

-- Actualizar registros existentes que tengan NULL
UPDATE usuarios SET ciudad = 'Ciudad Autónoma de Buenos Aires' WHERE ciudad IS NULL; 