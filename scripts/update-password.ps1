# Script de PowerShell para actualizar la contraseña directamente con MySQL

# Configuración
$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"  # Ajusta esta ruta según tu instalación
$dbHost = "localhost"
$dbUser = "root"
$dbPass = ""
$dbName = "a_la_mesa"
$email = "tiendanexus.info@gmail.com"
$newPassword = "123456"

# Generar hash bcrypt (requiere Node.js instalado)
$hash = node -e "const bcrypt = require('bcryptjs'); const salt = bcrypt.genSaltSync(10); console.log(bcrypt.hashSync('$newPassword', salt));"

Write-Host "Hash generado: $hash"

# Comando SQL para actualizar la contraseña
$sql = @"
USE $dbName;
UPDATE usuarios 
SET password = '$hash' 
WHERE email = '$email';

-- Verificar el cambio
SELECT id, email, tipo_usuario, LENGTH(password) as pwd_length 
FROM usuarios 
WHERE email = '$email';
"@

# Guardar el SQL en un archivo temporal
$sql | Out-File -FilePath "$PSScriptRoot\temp_update.sql" -Encoding utf8

# Ejecutar el comando MySQL
& $mysqlPath -h $dbHost -u $dbUser -e "source $PSScriptRoot\temp_update.sql"

# Limpiar archivo temporal
Remove-Item "$PSScriptRoot\temp_update.sql"

Write-Host "Proceso completado. Verifica los resultados arriba."
