# Sistema de Verificación de Cobros Vencidos

Este sistema verifica automáticamente los cobros pendientes y los marca como vencidos cuando han pasado más de 72 horas desde la fecha de vencimiento.

## 📋 Archivos del Sistema

### Scripts Principales
- `check-expired-cobros.js` - Script principal de verificación
- `run-expired-cobros-check.bat` - Script para Windows
- `run-expired-cobros-check.sh` - Script para Linux/Unix

## 🚀 Cómo Ejecutar

### Ejecución Manual

#### Windows
```batch
# Desde el directorio raíz del proyecto
scripts\run-expired-cobros-check.bat

# O directamente con Node.js
node scripts/check-expired-cobros.js
```

#### Linux/Unix
```bash
# Hacer ejecutable el script (solo la primera vez)
chmod +x scripts/run-expired-cobros-check.sh

# Ejecutar
./scripts/run-expired-cobros-check.sh

# O directamente con Node.js
node scripts/check-expired-cobros.js
```

## ⏰ Programación Automática

### Windows - Programador de Tareas

1. **Abrir Programador de Tareas**:
   - Buscar "Programador de tareas" en el menú Inicio
   - O ejecutar: `taskschd.msc`

2. **Crear Nueva Tarea**:
   - Click derecho → "Crear tarea básica"
   - Nombre: "Verificar Cobros Vencidos"
   - Descripción: "Verifica y marca cobros vencidos cada hora"

3. **Configurar Disparador**:
   - "Diariamente" o "Cada hora"
   - Recomendado: Cada 1 hora

4. **Configurar Acción**:
   - Acción: "Iniciar un programa"
   - Programa: `C:\Windows\System32\cmd.exe`
   - Argumentos: `/c "C:\ruta\a\tu\proyecto\scripts\run-expired-cobros-check.bat"`
   - Directorio inicial: `C:\ruta\a\tu\proyecto`

5. **Configurar Condiciones**:
   - Marcar "Ejecutar solo si el usuario inició sesión" (opcional)
   - Marcar "Ejecutar con los privilegios más altos" (recomendado)

### Linux/Unix - Cron

1. **Editar crontab**:
   ```bash
   crontab -e
   ```

2. **Agregar línea para ejecución cada hora**:
   ```bash
   # Verificar cobros vencidos cada hora
   0 * * * * /ruta/a/tu/proyecto/scripts/run-expired-cobros-check.sh >> /ruta/a/tu/proyecto/logs/cobros-check.log 2>&1
   ```

3. **Para ejecución cada 30 minutos**:
   ```bash
   # Verificar cobros vencidos cada 30 minutos
   */30 * * * * /ruta/a/tu/proyecto/scripts/run-expired-cobros-check.sh >> /ruta/a/tu/proyecto/logs/cobros-check.log 2>&1
   ```

## 📊 Qué Hace el Sistema

### Verificación Automática
1. **Busca cobros pendientes** con fecha de vencimiento anterior a 72 horas
2. **Cambia el estado** de `pendiente` a `vencido`
3. **Crea notificaciones** para los restaurantes afectados
4. **Registra estadísticas** de cobros por estado

### Notificaciones
- Se crean notificaciones automáticas en el sistema
- Los restaurantes reciben alertas sobre cobros vencidos
- Las notificaciones incluyen el monto y enlaces directos

### Logging
- Registra todas las operaciones realizadas
- Muestra estadísticas antes y después del proceso
- Facilita el seguimiento y debugging

## ⚙️ Configuración

### Variables de Entorno
El script utiliza las mismas variables de entorno que la aplicación principal:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=tu_password
DB_NAME=a_la_mesa
```

### Personalización
Puedes modificar estos parámetros en el script:

```javascript
// Cambiar el tiempo de vencimiento (72 horas por defecto)
const fechaLimite = new Date(now.getTime() - (72 * 60 * 60 * 1000));

// Cambiar el mensaje de notificación
const mensaje = `Su cobro semanal por $${cobro.monto_comision} ha vencido...`;
```

## 📈 Monitoreo

### Ver Logs
```bash
# Windows
type logs\cobros-check.log

# Linux
tail -f logs/cobros-check.log
```

### Verificar Estado de Cobros
```sql
SELECT estado, COUNT(*) as cantidad, SUM(monto_comision) as total
FROM cobros_semanales
GROUP BY estado;
```

## 🔧 Solución de Problemas

### Error de Conexión a BD
- Verificar que las variables de entorno estén configuradas
- Asegurarse de que MySQL esté ejecutándose
- Verificar credenciales de conexión

### Script No Se Ejecuta
- Verificar permisos de ejecución (Linux)
- Verificar rutas absolutas en scripts
- Revisar logs de error

### Notificaciones No Se Crean
- Verificar que exista la tabla `notificaciones_sistema`
- Revisar que los restaurantes tengan usuarios asociados
- Verificar permisos de escritura en BD

## 📋 Ejemplo de Salida

```
🚀 Iniciando verificación de cobros vencidos...
==================================================
🔍 Verificando cobros vencidos...
📅 Fecha actual: 2025-09-08
⏰ Fecha límite (72h atrás): 2025-09-05
📊 Encontrados 3 cobros pendientes vencidos

📋 Cobros que serán marcados como vencidos:
   - ID 45: Restaurante El Buen Sabor - $1250.00 - Vencido hace 5 días
   - ID 47: Pizzeria Napoli - $890.50 - Vencido hace 3 días
   - ID 48: Hamburguesería Express - $675.25 - Vencido hace 4 días

✅ Actualizados 3 cobros a estado 'vencido'
📬 Notificación enviada a Juan Pérez
📬 Notificación enviada a María González
📬 Notificación enviada a Carlos Rodríguez

📊 Estadísticas de cobros:
   pagado: 25 cobros - $45670.50
   pendiente: 12 cobros - $15230.75
   vencido: 8 cobros - $8945.25
   exonerado: 3 cobros - $1250.00

🎉 Proceso completado exitosamente
==================================================
✅ Script ejecutado exitosamente
```

## 🔄 Estados de Cobros

- **pendiente**: Cobro generado, esperando pago
- **pagado**: Cobro completado exitosamente
- **vencido**: Cobro no pagado dentro del plazo (72h)
- **exonerado**: Cobro condonado por administración

## 📞 Soporte

Si encuentras problemas:
1. Revisar los logs del script
2. Verificar la conexión a la base de datos
3. Confirmar que las tablas existen y tienen la estructura correcta
4. Revisar permisos de ejecución de scripts
