# 🚀 Despliegue en Vercel - A la Mesa

## 📋 Requisitos Previos

- ✅ **GitHub vinculado** con Vercel
- ✅ **Proyecto ya creado** en Vercel
- ✅ **Base de datos MySQL** externa (PlanetScale, Railway, etc.)
- ✅ **Claves VAPID** generadas para notificaciones push

## 🎯 Método Rápido - Usando el Script

### Opción 1: Ejecutar el script automático
```bash
# Hacer ejecutable el script (solo en Linux/Mac)
chmod +x deploy-vercel.sh

# Ejecutar el despliegue
./deploy-vercel.sh
```

### Opción 2: Despliegue manual paso a paso

#### Paso 1: Commitear cambios
```bash
git add .
git commit -m "feat: mejoras en notificaciones push y limpieza de código"
git push origin main
```

#### Paso 2: Desplegar a Vercel
```bash
# Instalar Vercel CLI si no lo tienes
npm install -g vercel

# Login en Vercel
vercel login

# Vincular proyecto (primera vez)
vercel link

# Desplegar
vercel --prod
```

## ⚙️ Variables de Entorno Requeridas

Configura estas variables en Vercel Dashboard > Project Settings > Environment Variables:

### Obligatorias:
```bash
NODE_ENV=production
DATABASE_URL=mysql://usuario:password@host:puerto/database
SESSION_SECRET=tu_cadena_secreta_muy_segura_aqui
```

### Para Notificaciones Push (Obligatorias):
```bash
VAPID_PUBLIC_KEY=tu_clave_publica_vapid
VAPID_PRIVATE_KEY=tu_clave_privada_vapid
```

### Opcionales:
```bash
MERCADO_PAGO_ACCESS_TOKEN=tu_token_mercadopago
CORS_ORIGINS=https://tu-dominio.com,https://otro-dominio.com
```

## 🔑 Generar Claves VAPID

Si no tienes claves VAPID, puedes generarlas:

### Opción 1: Usar el script incluido
```bash
node config/vapid.js
```

### Opción 2: Comando manual
```bash
npm install -g web-push
web-push generate-vapid-keys
```

## 🧪 Probar las Notificaciones Push

Después del despliegue, ve a:
```
https://tu-dominio.vercel.app/push-debug
```

### Pruebas disponibles:
1. **Diagnóstico Completo** - Verifica todo el sistema
2. **Prueba Paso a Paso** - Identifica problemas específicos
3. **Probar Envío Servidor** - Envía notificación de prueba
4. **Probar Notificación Local** - Verifica funcionamiento básico

## 🔧 Solución de Problemas

### Error: "Registration failed - permission denied"
```bash
# Solución: Limpia datos del sitio en el navegador
# Chrome: Configuración > Privacidad > Borrar datos de navegación
# Firefox: Configuración > Privacidad > Borrar datos
```

### Error: "VAPID keys not configured"
```bash
# Verifica que las variables de entorno estén configuradas
vercel env ls
```

### Error: "Database connection failed"
```bash
# Verifica la URL de la base de datos
echo $DATABASE_URL
```

## 📊 Monitoreo y Logs

### Ver logs en Vercel:
```bash
vercel logs
```

### Ver variables de entorno:
```bash
vercel env ls
```

### Ver dominios configurados:
```bash
vercel domains ls
```

## 🚀 URLs Importantes Después del Despliegue

- **Sitio principal**: `https://tu-dominio.vercel.app`
- **Debug notificaciones**: `https://tu-dominio.vercel.app/push-debug`
- **Dashboard**: `https://tu-dominio.vercel.app/dashboard`
- **API push**: `https://tu-dominio.vercel.app/api/push`

## 📝 Checklist Post-Despliegue

- [ ] ✅ Sitio carga correctamente
- [ ] ✅ Base de datos conectada
- [ ] ✅ Login funciona
- [ ] ✅ Notificaciones push funcionan (`/push-debug`)
- [ ] ✅ Variables de entorno configuradas
- [ ] ✅ Dominio personalizado (opcional)

## 🎉 ¡Listo!

Tu aplicación "A la Mesa" está ahora desplegada en Vercel con todas las mejoras implementadas:

- ✅ Sistema de notificaciones push mejorado
- ✅ Diagnóstico completo de problemas
- ✅ Código limpio sin datos sensibles
- ✅ Configuración optimizada para Vercel

¡Disfruta tu despliegue! 🚀
