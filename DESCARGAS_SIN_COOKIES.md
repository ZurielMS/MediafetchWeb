# 🎬 Cómo Descargar Sin Cookies - Guía Rápida

## El Problema
Error 422 en servidor Render = YouTube bloquea descargas anónimas desde la nube

## Las 3 Soluciones

### 🏆 SOLUCIÓN 1: Ejecutar Localmente (MEJOR - 100% Garantizado)

```bash
npm start
# Luego abre: http://localhost:3000
```

✅ **Funciona siempre**  
✅ **Sin cookies**  
✅ **Sin proxy**  
✅ **Más rápido**

---

### 🔐 SOLUCIÓN 2: Agregar Cookies YouTube (Para Servidor Remoto)

#### Paso 1: Exportar tus cookies
**Opción A - Con Extensión (MÁS FÁCIL):**
1. Instala: `Get cookies.txt LOCALLY` en tu navegador
2. Ve a YouTube.com
3. Haz clic en la extensión
4. Se descarga automáticamente `cookies.txt`
5. Abre el archivo en bloc de notas y copia todo

**Opción B - Consola del Navegador:**
1. Ve a YouTube.com
2. Presiona F12 → Console
3. Pega esto:
```javascript
copy(document.cookie); alert('✅ Copiadas');
```
4. Las cookies ya están en tu portapapeles

#### Paso 2: Configurar en MediaFetch
1. Ve a tu app: `https://mediafetchweb.onrender.com`
2. Pestaña **⚙️ Ajustes**
3. Sección **"Cookies de Sesión"**
4. Pega las cookies
5. Haz clic **"Guardar cookies"**
6. Debe decir: `✅ X cookies guardadas`

✅ **Funciona en servidor remoto**  
✅ **Sin proxy**  
⚠️ **Cookies expiran en 1-3 meses**

---

### 🌐 SOLUCIÓN 3: Usar Proxy (Avanzado)

#### Para Render:
1. Ve a tu servicio en Render
2. Settings → Environment
3. Agrega:
   ```
   HTTP_PROXY = http://proxy.datacenter.proxy:3128
   ```
4. Redeploy

#### Para tu PC:
```powershell
$env:HTTP_PROXY = "http://proxy.datacenter.proxy:3128"
npm start
```

⚠️ **No garantizado al 100%**  
⚠️ **Proxies pueden ser lentos**  
✅ **Sin cookies necesarias**

---

## 🎯 Recomendación por Caso

| Caso | Solución |
|------|----------|
| Usar en tu PC | Solución 1 (npm start) |
| Servidor remoto | Solución 2 (Cookies) |
| Servidor + Sin cookies | Solución 3 (Proxy) |
| Descargar privado | Solución 2 (Cookies) |

---

## ⚡ Resumen Ultra Rápido

```bash
# Tu PC (MEJOR):
npm start

# Servidor remoto (RECOMENDADO):
# Ve a Ajustes → Cargar cookies YouTube

# Alternativa:
# Render → Environment → HTTP_PROXY = ...
```

**¿Problemas?** Ve a: [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)

