# 🔧 Guía de Solución de Problemas - MediaFetch Web

## Error 422: YouTube Bloqueó las Descargas

**Síntomas:**
- El navegador muestra: `422 Unprocessable Content`
- El mensaje dice: "YouTube bloqueó las peticiones anónimas desde la IP de este servidor"

**Por qué ocurre:**
YouTube detecta cuando estás usando un servidor en la nube (Render, Heroku, etc.) y bloquea las solicitudes anónimas. Esto es una medida de seguridad de YouTube.

---

## ✅ Soluciones Disponibles

### 🏆 MEJOR: Ejecutar Localmente (Garantizado 100%)

**Requisitos:**
- Node.js 14+ instalado
- FFmpeg instalado (ya incluido via `imageio-ffmpeg`)

**Pasos:**
1. Abre PowerShell o CMD en la carpeta del proyecto
2. Ejecuta:
   ```powershell
   npm start
   ```
3. Abre tu navegador en: `http://localhost:3000`
4. ✅ ¡Funciona sin restricciones!

**Ventajas:**
- ✅ Sin restricciones de YouTube
- ✅ Más rápido (sin latencia de servidor)
- ✅ Más privado (todo en tu equipo)
- ✅ Funciona sin cookies

---

### 🔐 ALTERNATIVA: Usar Cookies de YouTube

**Requisitos:**
- Una cuenta activa de YouTube
- 2 minutos para exportar las cookies

**Pasos para exportar cookies:**

#### Opción 1: Usando Extensión (MÁS FÁCIL)
1. Instala `"Get cookies.txt LOCALLY"` en tu navegador:
   - Chrome: https://chrome.google.com/webstore
   - Firefox: https://addons.mozilla.org/firefox/
2. Ve a https://www.youtube.com
3. Inicia sesión con tu cuenta
4. Haz clic en la extensión
5. Descargará automáticamente `cookies.txt`
6. Abre el archivo con un editor de texto y copia su contenido

#### Opción 2: Desde la Consola del Navegador (MANUAL)
1. Ve a https://www.youtube.com
2. Inicia sesión
3. Abre la consola del navegador (F12 → Console)
4. Pega este código:
   ```javascript
   const cookies = document.cookie
     .split(';')
     .map(c => c.trim())
     .join('\n');
   console.log(cookies);
   copy(cookies);
   alert('✅ Cookies copiadas al portapapeles');
   ```
5. Las cookies se copiarán automáticamente

**Pasos para configurarlas en MediaFetch:**

1. Ve a tu aplicación (local: `http://localhost:3000` o servidor: `https://mediafetchweb.onrender.com`)
2. Haz clic en la pestaña **⚙️ Ajustes**
3. Ve a la sección **"Cookies de Sesión"**
4. Pega las cookies en el campo de texto
5. Haz clic en **"Guardar cookies"**
6. Debe aparecer: `"✅ X cookies guardadas con éxito!"`

**Ventajas:**
- ✅ Funciona en servidor remoto
- ✅ Acceso a contenido privado
- ✅ Puedes usar descargas ilimitadas

**Desventajas:**
- ⚠️ Cookies expiran cada 1-3 meses
- ⚠️ YouTube puede revocar el acceso

---

### 🌐 AVANZADO: Usar un Proxy (Para Servidores)

Si despliegas en **Render** o **Heroku** sin cookies, puedes usar un proxy:

**Pasos:**

1. **En Render:**
   - Ve a tu servicio en Render
   - Settings → Environment Variables
   - Agrega: 
     ```
     HTTP_PROXY = http://proxy.datacenter.proxy:3128
     ```
   - Redeploy

2. **En tu máquina local (`.env`):**
   ```
   HTTP_PROXY=http://proxy.datacenter.proxy:3128
   ```
   Luego reinicia: `npm start`

**Ventajas:**
- ✅ No necesitas cookies
- ✅ Funciona en servidores remotos

**Desventajas:**
- ⚠️ Proxies públicos pueden ser lentos o poco confiables
- ⚠️ No garantizado al 100%

---

## 📋 Matriz de Soluciones

| Escenario | Solución | Dificultad | Funciona |
|-----------|----------|-----------|----------|
| Usar en tu PC | Ejecutar `npm start` | ⭐ Fácil | ✅ 100% |
| Servidor remoto sin cookies | Agregar cookies YouTube | ⭐⭐ Fácil | ✅ 100% |
| Servidor remoto sin cookies | Usar proxy | ⭐⭐⭐ Avanzado | ⚠️ 70% |
| Descargar privado | Cookies YouTube | ⭐⭐ Fácil | ✅ 100% |

---

## ❓ Preguntas Frecuentes

### ¿Mis cookies expirarán?
Sí, típicamente en 1-3 meses. Cuando expiren, verás el error 422 de nuevo. Simplemente exporta e importa cookies nuevas.

### ¿Las cookies son seguras?
Sí, se guardan en tu servidor en `session/cookies.txt`. No se comparten con nadie. Pero no compartas este archivo con otros.

### ¿Puedo usar cualquier cuenta?
Sí, funciona con cualquier cuenta de YouTube. Las descargas privadas funcionarán si tu cuenta tiene acceso.

### ¿Por qué YouTube bloquea desde servidores?
YouTube considera las solicitudes desde datacenters como "bots" y bloquea las solicitudes de extracción anónimas. Es una medida contra la descarga masiva.

### ¿Qué pasa si pierdo mis cookies?
No importa, solo exporta e importa nuevas. No hay límite de intentos.

---

## 🚀 Resumen Rápido

| Uso | Recomendación |
|-----|-------------|
| Personal en tu PC | `npm start` (sin cookies) |
| Servidor remoto privado | Agregar cookies YouTube |
| Producción pública | Cookies + Proxy (redundancia) |

**Mejor opción para la mayoría:** Ejecutar localmente con `npm start`. ⭐

