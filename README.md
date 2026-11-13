# MediaFetch Web — Descargador Responsivo de Video (MP4) y Música (MP3)

Aplicación web moderna y **100% responsiva** (adaptada para celulares, tablets y computadoras) para descargar videos y música en alta definición desde cualquier plataforma web (YouTube, YouTube Music, TikTok, Instagram, Facebook, X/Twitter, SoundCloud, Vimeo, etc.).

Todo el procesamiento de descarga y conversión se ejecuta de forma local mediante **yt-dlp** y **FFmpeg**.

---

## 📱 Diseño 100% Responsivo

La interfaz se adapta automáticamente a cualquier tamaño de pantalla:

- **Celulares (Móviles)**: Barra de navegación inferior táctil (*Bottom Navigation Bar*), tarjetas optimizadas para pantallas táctiles, controles accesibles con una mano y reproductor modal responsivo.
- **Tablets**: Distribución en columnas dinámicas, vista previa lateral y cuadrícula fluida de biblioteca.
- **Computadoras (Escritorio)**: Barra de navegación superior con monitor de descargas en vivo en dos columnas (entrada + progreso en tiempo real).

---

## 🚀 Funcionalidades Principales

### 1. Pestaña Descargar
- **Pegar enlace con un clic** desde el portapapeles o mediante teclado (`Ctrl+V`).
- **Detección inteligente de plataforma** (YouTube, TikTok, Instagram, Facebook, X, etc.).
- **Análisis y vista previa**: Muestra miniatura, duración, autor/canal, extractor y resoluciones disponibles.
- **Dos formatos de salida**:
  - **MP4 (Video HD + Audio)**: Calidades `Mejor disponible`, `1080p Full HD`, `720p HD`, `480p` y `360p` (códec H.264/AAC para máxima compatibilidad).
  - **MP3 (Solo Música / Audio)**: Extracción y conversión real con FFmpeg en `320 kbps (Alta)`, `192 kbps (Estándar)` o `128 kbps (Ligero)`.
- **Cola y progreso en vivo**: Barra de porcentaje animada, velocidad de descarga, tiempo restante estimado (ETA) y botón para cancelar.
- **Botón de descarga directa al finalizar**: Al terminar, permite guardar el archivo directamente en la carpeta `Descargas` de tu computadora o celular.

### 2. Pestaña Navegador & Captura
- Navegador integrado con barra de direcciones y buscador.
- **Accesos rápidos**: YouTube, YouTube Music, TikTok, Instagram, Facebook, X (Twitter) y SoundCloud.
- Botón flotante **"Descargar URL actual"** para enviar el video que estás viendo directamente al descargador.
- Indicador de estado de cookies de sesión activas.

### 3. Pestaña Biblioteca
- Listado visual de todos tus archivos descargados.
- **Buscador en tiempo real** por título, formato o plataforma.
- **Filtros rápidos**: `Todos`, `Videos (MP4)` y `Música (MP3)`.
- **Reproductor HTML5 integrado**: Reproduce videos o pistas de audio directamente en la web sin salir de la página (con soporte de pantalla completa, cambio de velocidad y barra de tiempo).
- **Descargar a mi equipo**: Enlace directo para guardar el archivo en tu dispositivo.
- Copiar enlace directo y eliminar archivo del disco.

### 4. Pestaña Ajustes
- Configuración de formato y calidades preferidas por defecto.
- Opción de auto-analizar el enlace apenas se pegue.
- **Gestor de Cookies de Sesión (Netscape `cookies.txt`)**: Pega tus cookies de YouTube, Instagram o Facebook para descargar videos privados, cursos o contenido que requiera inicio de sesión.
- **Actualizador integrado de yt-dlp**: Actualiza el motor de extracción con un solo clic.

---

## 📂 Estructura del Proyecto

```text
MediaFetch-Web/
├── package.json        # Dependencias Node.js (express, cors) y scripts
├── server.js           # Servidor backend Express (API + streaming + yt-dlp/ffmpeg)
├── server.py           # Opción de servidor alternativo en Python
├── downloads/          # Directorio donde se guardan los archivos MP4 y MP3
├── session/            # Almacén de cookies.txt para sesiones privadas
├── public/             # Aplicación web frontend responsiva (SPA)
│   ├── index.html      # Estructura semántica responsive (mobile & desktop)
│   ├── css/
│   │   └── styles.css  # Tema oscuro moderno, glassmorphism y media queries
│   └── js/
│       ├── app.js      # Coordinador principal, pestañas, toasts y estado
│       ├── downloader.js # Analizador, selección MP4/MP3 y progreso en vivo SSE
│       ├── browser.js  # Navegador interno, marcadores y captura de URL
│       ├── library.js  # Biblioteca local, buscador, filtros y descargas
│       ├── settings.js # Ajustes por defecto, cookies y actualización de yt-dlp
│       └── player.js   # Reproductor modal responsivo de video y audio
└── README.md           # Guía completa de uso e instalación
```

---

## 🛠️ Cómo Iniciar la Aplicación Web

### Opción A: Iniciar con Node.js (Recomendada)

1. Abre tu terminal en la carpeta del proyecto:
   ```powershell
   cd c:\Users\ZurielMontaño\Desktop\MediaFetch-Web
   ```
2. Inicia el servidor:
   ```powershell
   npm start
   ```
3. Abre tu navegador web en:
   👉 **http://localhost:3000**

---

### Opción B: Iniciar con Python

Si prefieres usar Python directamente:
```powershell
cd c:\Users\ZurielMontaño\Desktop\MediaFetch-Web
python server.py
```
Abre tu navegador web en:
👉 **http://localhost:3000**

