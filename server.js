const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { createInterface } = require('readline');
const { spawn, execSync, exec } = require('child_process');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const ROOT_DIR = __dirname;
const DOWNLOADS_DIR = path.join(ROOT_DIR, 'downloads');
const SESSION_DIR = path.join(ROOT_DIR, 'session');
const METADATA_FILE = path.join(DOWNLOADS_DIR, 'metadata.json');
const COOKIES_FILE = path.join(SESSION_DIR, 'cookies.txt');
const sessionCookiesEnabled = process.env.RENDER !== 'true';

// Get proxy from environment (useful for cloud servers without cookies)
const PROXY_URL = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || null;

if (PROXY_URL) {
  console.log(`[MediaFetch] Proxy configurado: ${PROXY_URL}`);
}

if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });
if (!fs.existsSync(METADATA_FILE)) fs.writeFileSync(METADATA_FILE, JSON.stringify([]), 'utf8');

// Carga el archivo de sesión solo fuera de Render y evita pasar la variable a los procesos hijos.
const startupCookies = sessionCookiesEnabled ? process.env.YOUTUBE_COOKIES?.trim() : '';
delete process.env.YOUTUBE_COOKIES;
if (startupCookies && (!fs.existsSync(COOKIES_FILE) || fs.statSync(COOKIES_FILE).size === 0)) {
  try {
    fs.writeFileSync(COOKIES_FILE, startupCookies + '\n', 'utf8');
    console.log('[MediaFetch] Archivo de sesión inicializado desde el entorno.');
  } catch (err) {
    console.error('[MediaFetch] Error al inicializar cookies desde el entorno:', err);
  }
}

// Ensure ~/.local/bin and ./bin are included in PATH for cloud environments (Render, etc.)
const extraPaths = [
  path.join(ROOT_DIR, 'bin'),
  path.join(process.env.HOME || '', '.local', 'bin'),
  '/usr/local/bin',
  '/usr/bin'
].filter(p => p && fs.existsSync(p));

if (extraPaths.length > 0) {
  process.env.PATH = `${extraPaths.join(path.delimiter)}${path.delimiter}${process.env.PATH || ''}`;
}

// Detect Python command (python3 on Linux/Render, python on Windows)
let pythonCmd = 'python';
if (process.platform === 'win32') {
  try {
    execSync('python --version', { stdio: 'ignore' });
    pythonCmd = 'python';
  } catch (_) {
    try {
      execSync('py --version', { stdio: 'ignore' });
      pythonCmd = 'py';
    } catch (__) {
      pythonCmd = 'python';
    }
  }
} else {
  try {
    execSync('python3 --version', { stdio: 'ignore' });
    pythonCmd = 'python3';
  } catch (_) {
    try {
      execSync('python --version', { stdio: 'ignore' });
      pythonCmd = 'python';
    } catch (__) {
      pythonCmd = 'python3';
    }
  }
}
console.log(`[MediaFetch] Python detectado: ${pythonCmd}`);

// Helper: detect available yt-dlp binary or python module
const { execFileSync } = require('child_process');

function detectYtdlpRunner() {
  const options = [
    { cmd: 'yt-dlp', prefixArgs: [], desc: 'yt-dlp CLI' },
    { cmd: path.join(ROOT_DIR, 'bin', 'yt-dlp'), prefixArgs: [], desc: 'local bin/yt-dlp' },
    { cmd: path.join(process.env.HOME || '', '.local', 'bin', 'yt-dlp'), prefixArgs: [], desc: 'user .local/bin/yt-dlp' },
    { cmd: pythonCmd, prefixArgs: ['-m', 'yt_dlp'], desc: `${pythonCmd} module` },
    { cmd: 'python3', prefixArgs: ['-m', 'yt_dlp'], desc: 'python3 module' },
    { cmd: 'python', prefixArgs: ['-m', 'yt_dlp'], desc: 'python module' },
  ];

  for (const opt of options) {
    try {
      const ver = execFileSync(opt.cmd, [...opt.prefixArgs, '--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      }).trim();
      if (ver && /^\d{4}\./.test(ver)) {
        return { cmd: opt.cmd, prefixArgs: opt.prefixArgs, version: ver, desc: opt.desc };
      }
    } catch (_) {}
  }
  return null;
}

let ytdlpRunner = detectYtdlpRunner();

// Self-healing: if yt-dlp is not available, install it automatically
if (!ytdlpRunner) {
  console.log('[MediaFetch] yt-dlp no detectado. Intentando instalación automática...');
  try {
    execSync(`${pythonCmd} -m pip install --upgrade --break-system-packages yt-dlp || pip3 install --upgrade --break-system-packages yt-dlp || true`, { stdio: 'ignore' });
    ytdlpRunner = detectYtdlpRunner();
  } catch (err) {
    console.error('[MediaFetch] Error en auto-instalación pip:', err.message);
  }

  // If still not detected on Linux, download the official standalone executable
  if (!ytdlpRunner && process.platform !== 'win32') {
    try {
      console.log('[MediaFetch] Descargando binario oficial independiente de yt-dlp...');
      const binDir = path.join(ROOT_DIR, 'bin');
      if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
      const targetBin = path.join(binDir, 'yt-dlp');
      execSync(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${targetBin}" && chmod +x "${targetBin}"`, { stdio: 'ignore' });
      ytdlpRunner = detectYtdlpRunner();
    } catch (curlErr) {
      console.error('[MediaFetch] Error al descargar binario independiente:', curlErr.message);
    }
  }
}

if (ytdlpRunner) {
  console.log(`[MediaFetch] yt-dlp listo (${ytdlpRunner.version}) vía: ${ytdlpRunner.desc}`);
} else {
  ytdlpRunner = { cmd: pythonCmd, prefixArgs: ['-m', 'yt_dlp'], version: 'No instalado', desc: 'fallback' };
  console.warn('[MediaFetch] Advertencia: yt-dlp no se pudo inicializar.');
}

// Detect FFMPEG path from imageio_ffmpeg or system PATH (Encoding-safe for Windows & Linux)
let ffmpegPath = '';
try {
  const rawBytes = execFileSync(pythonCmd, ['-c', 'import imageio_ffmpeg, sys; sys.stdout.buffer.write(imageio_ffmpeg.get_ffmpeg_exe().encode("utf-8"))']);
  const detected = rawBytes.toString('utf8').trim();
  if (detected && fs.existsSync(detected)) {
    ffmpegPath = detected;
    console.log(`[MediaFetch] FFMPEG detectado en: ${ffmpegPath}`);
  } else {
    ffmpegPath = 'ffmpeg';
    console.log('[MediaFetch] imageio_ffmpeg no disponible o ruta inválida, usando ffmpeg del sistema.');
  }
} catch (e) {
  ffmpegPath = 'ffmpeg';
  console.log('[MediaFetch] imageio_ffmpeg no detectado, usando ffmpeg del sistema.');
}

// Una ruta configurada no garantiza que FFmpeg pueda ejecutarse en Render.
let ffmpegReady = false;
try {
  execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore', timeout: 5000, windowsHide: true });
  ffmpegReady = true;
} catch (_) {
  console.warn('[MediaFetch] No se pudo ejecutar FFmpeg.');
}

// yt-dlp necesita un runtime de JavaScript para procesar los desafíos de YouTube.
const ytdlpCommonArgs = ['--js-runtimes', 'node'];
// En Render, los archivos de configuración de yt-dlp tampoco pueden añadir cookies.
if (!sessionCookiesEnabled) ytdlpCommonArgs.push('--ignore-config');

// Debug Logging File
const DEBUG_LOG_FILE = path.join(ROOT_DIR, 'debug.log');

function logDebug(level, message, details = null) {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (details) {
    if (typeof details === 'object') {
      try {
        line += `\n  Details: ${JSON.stringify(details, null, 2)}`;
      } catch (e) {
        line += `\n  Details: ${details}`;
      }
    } else {
      line += `\n  Details: ${details}`;
    }
  }
  line += '\n';

  if (level === 'error') {
    console.error(line.trim());
  } else {
    console.log(line.trim());
  }

  try {
    fs.appendFileSync(DEBUG_LOG_FILE, line, 'utf8');
  } catch (err) {}
}

// Initial boot log
logDebug('info', `Servidor iniciado en puerto ${PORT}. FFMPEG: ${ffmpegPath || 'detectando...'}`);

// Middleware
app.use(cors({ origin: true, credentials: true }));
if (!sessionCookiesEnabled) {
  const rejectSessionChange = (req, res) => res.status(403).json({
    error: 'Las cookies de sesión están desactivadas en Render.',
  });
  app.route('/api/session/cookies').post(rejectSessionChange).delete(rejectSessionChange);
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api') || res.statusCode >= 400) {
      logDebug(
        res.statusCode >= 400 ? 'warn' : 'info',
        `${req.method} ${req.originalUrl} -> HTTP ${res.statusCode} (${duration}ms)`
      );
    }
  });
  next();
});

// Client Error Reporter Endpoint
app.post('/api/debug/client-log', (req, res) => {
  const { type, message, stack, url, line, col } = req.body || {};
  logDebug('client-error', `[Frontend] ${message || 'Error de navegador'}`, {
    type,
    url,
    line,
    col,
    stack
  });
  res.json({ ok: true });
});

// Debug Logs Viewer Endpoint
app.get('/api/debug/logs', (req, res) => {
  if (!fs.existsSync(DEBUG_LOG_FILE)) {
    return res.json({ logs: [] });
  }
  try {
    const raw = fs.readFileSync(DEBUG_LOG_FILE, 'utf8');
    const lines = raw.trim().split('\n');
    res.json({ logs: lines.slice(-250) });
  } catch (err) {
    res.status(500).json({ error: 'Error al leer debug.log' });
  }
});

app.use(express.static(path.join(ROOT_DIR, 'public')));

// Active download tasks in-memory store
const activeTasks = new Map();
// SSE subscribers: taskId -> Set of response objects
const sseSubscribers = new Map();

function broadcastTaskProgress(taskId, data) {
  const task = activeTasks.get(taskId) || {};
  const merged = { ...task, ...data };
  activeTasks.set(taskId, merged);

  const subs = sseSubscribers.get(taskId);
  if (subs && subs.size > 0) {
    const payload = `data: ${JSON.stringify({ ...merged, process: undefined })}\n\n`;
    for (const res of subs) {
      try {
        res.write(payload);
      } catch (err) {
        subs.delete(res);
      }
    }
  }
}

// Helper: Read library metadata
function readLibrary() {
  try {
    if (!fs.existsSync(METADATA_FILE)) return [];
    const raw = fs.readFileSync(METADATA_FILE, 'utf8');
    const items = JSON.parse(raw);
    // Verify file still exists on disk
    return items.filter(item => {
      const filePath = path.join(DOWNLOADS_DIR, item.fileName);
      return fs.existsSync(filePath);
    });
  } catch (err) {
    console.error('Error reading metadata.json:', err);
    return [];
  }
}

// Helper: Save library metadata
function saveLibrary(items) {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving metadata.json:', err);
  }
}

// Helper: Sanitize filename
function sanitizeFileName(name, fallback) {
  const clean = (name || '')
    .replace(/[\\/:*?"<>|\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  return clean.length > 0 ? clean.substring(0, 110) : fallback;
}

// Helper: Platform detector
function detectPlatform(url) {
  const lower = (url || '').toLowerCase();
  if (lower.includes('music.youtube.com')) return { id: 'ytmusic', label: 'YouTube Music', color: '#EF4444' };
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return { id: 'youtube', label: 'YouTube', color: '#EF4444' };
  if (lower.includes('tiktok.com')) return { id: 'tiktok', label: 'TikTok', color: '#2DD4BF' };
  if (lower.includes('instagram.com')) return { id: 'instagram', label: 'Instagram', color: '#EC4899' };
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) return { id: 'facebook', label: 'Facebook', color: '#3B82F6' };
  if (lower.includes('twitter.com') || lower.includes('x.com')) return { id: 'x', label: 'X (Twitter)', color: '#E2E8F0' };
  if (lower.includes('soundcloud.com')) return { id: 'soundcloud', label: 'SoundCloud', color: '#F97316' };
  if (lower.includes('vimeo.com')) return { id: 'vimeo', label: 'Vimeo', color: '#38BDF8' };
  if (lower.includes('twitch.tv')) return { id: 'twitch', label: 'Twitch', color: '#A855F7' };
  if (lower.includes('reddit.com') || lower.includes('redd.it')) return { id: 'reddit', label: 'Reddit', color: '#FB7185' };
  if (/\.(mp4|mp3|m4a|webm|mkv|m3u8)(\?|$)/i.test(lower)) return { id: 'direct', label: 'Enlace directo', color: '#10B981' };
  return { id: 'web', label: 'Enlace web', color: '#6366F1' };
}

// --------------------------------------------------------------------------
// API Endpoints
// --------------------------------------------------------------------------

// 1. Status
app.get('/api/status', (req, res) => {
  let ytdlpVersion = 'Desconocida';
  try {
    const ver = execFileSync(ytdlpRunner.cmd, [...ytdlpRunner.prefixArgs, '--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
    if (ver) ytdlpVersion = ver;
  } catch (err) {
    const recheck = detectYtdlpRunner();
    if (recheck) {
      ytdlpRunner = recheck;
      ytdlpVersion = recheck.version;
    } else {
      ytdlpVersion = 'No instalado';
    }
  }

  const library = readLibrary();
  const hasCookies = Boolean(readSessionCookies());

  res.json({
    initialized: true,
    ytdlpVersion,
    ffmpegReady,
    ffmpegPath: ffmpegReady ? ffmpegPath : '',
    hasCookies,
    totalDownloads: library.length,
    downloadsDir: DOWNLOADS_DIR,
    nodeVersion: process.version,
    platform: process.platform,
  });
});

// Helper: Normalize Media URLs (strips dynamic radio/mix query parameters, maps music.youtube.com)
function normalizeMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let cleanUrl = rawUrl.trim();

  // If it's a YouTube / YouTube Music watch URL, strip extraneous radio/mix/index playlist params
  // while keeping the exact video ID
  if (cleanUrl.includes('youtube.com/watch') || cleanUrl.includes('music.youtube.com/watch')) {
    try {
      const parsed = new URL(cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`);
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    } catch (_) {}
  }

  if (cleanUrl.includes('music.youtube.com')) {
    return cleanUrl.replace('music.youtube.com', 'www.youtube.com');
  }

  return cleanUrl;
}

// Helper: Execute yt-dlp command as a Promise with timeout and deadlock protection
function runYtdlpProcess(args, timeoutMs = 35000) {
  return new Promise(resolve => {
    const py = spawn(ytdlpRunner.cmd, [...ytdlpRunner.prefixArgs, ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], // Closes child stdin to prevent deadlocks in container environments
      env: { ...process.env, PYTHONUNBUFFERED: '1' }
    });
    let stdoutData = '';
    let stderrData = '';
    let timer = null;
    // Distingue el límite de tiempo de la app de un rechazo de la plataforma.
    let timedOut = false;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          py.kill('SIGKILL');
        } catch (_) {}
      }, timeoutMs);
    }

    py.stdout.on('data', chunk => {
      stdoutData += chunk.toString();
    });

    py.stderr.on('data', chunk => {
      stderrData += chunk.toString();
    });

    py.on('close', (code, signal) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code === null ? (signal ? -1 : 0) : code, stdout: stdoutData, stderr: stderrData, timedOut });
    });

    py.on('error', err => {
      if (timer) clearTimeout(timer);
      resolve({ code: -1, stdout: stdoutData, stderr: err.message, timedOut });
    });
  });
}

function mediaError(stderr, platform, timedOut = false) {
  const lines = stderr.trim().split('\n').reverse().map(l => l.trim()).filter(Boolean);
  const extractorError = lines.find(line => line.startsWith('ERROR:')) || lines[lines.length - 1] || '';
  // Muestra la causa reconocida de la falla y deja el detalle técnico en el registro.
  let error = 'No se pudo obtener el medio. Si el problema persiste, avisa al administrador.';
  let status = 422;
  let code = 'EXTRACTOR_FAILED';

  if (timedOut) {
    status = 504;
    code = 'EXTRACTOR_TIMEOUT';
    error = 'La operación superó el tiempo de espera. Inténtalo de nuevo más tarde.';
  } else if ((platform.id === 'youtube' || platform.id === 'ytmusic') &&
             /sign in to confirm you(?:['’]re| are) not a bot/i.test(extractorError)) {
    code = 'YOUTUBE_BOT_CHECK';
    error = 'YouTube solicitó una verificación anti-bot a este servidor. Abre el video en YouTube para continuar allí.';
  } else if (/sign in|logged.in|login required/i.test(extractorError)) {
    code = 'SIGN_IN_REQUIRED';
    error = 'La plataforma pidió iniciar sesión o verificar el acceso a este enlace.';
  } else if (/HTTP Error 429|429: Too Many Requests/i.test(extractorError)) {
    code = 'UPSTREAM_RATE_LIMIT';
    error = 'La plataforma limitó las solicitudes. Inténtalo de nuevo más tarde.';
  } else if (/HTTP Error 403|403: Forbidden/i.test(extractorError)) {
    code = 'UPSTREAM_ACCESS_DENIED';
    error = 'La plataforma rechazó el acceso al enlace desde el servidor.';
  }

  return { status, code, error };
}

// 2. Analyze URL
app.post('/api/analyze', async (req, res) => {
  const { url, useCookies = true } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'Debes proporcionar una URL válida.' });
  }

  const rawUrl = url.trim();
  const platform = detectPlatform(rawUrl);
  const cleanUrl = normalizeMediaUrl(rawUrl);

  const hasCookies = useCookies && readSessionCookies();

  // Deja que yt-dlp elija los clientes de YouTube compatibles con la solicitud.
  const args = ['--dump-single-json', '--no-playlist', '--socket-timeout', '12', ...ytdlpCommonArgs];
  if (ffmpegReady && ffmpegPath !== 'ffmpeg') {
    args.push('--ffmpeg-location', ffmpegPath);
  }
  if (PROXY_URL) {
    args.push('--proxy', PROXY_URL);
  }
  if (hasCookies) {
    args.push('--cookies', COOKIES_FILE);
  }
  // El separador hace que yt-dlp interprete la entrada del usuario como una URL.
  args.push('--', cleanUrl);
  const result = await runYtdlpProcess(args);

  if (result.code !== 0 || !result.stdout.trim()) {
    const { status, code, error } = mediaError(result.stderr, platform, result.timedOut);
    logDebug('error', `Falló el análisis con yt-dlp (código ${result.code}).`, {
      stderr: result.stderr.trim(),
      timedOut: result.timedOut,
    });
    return res.status(status).json({ code, error });
  }

  try {
    const info = JSON.parse(result.stdout);

    // Extract available resolutions
    const heights = new Set();
    if (Array.isArray(info.formats)) {
      for (const f of info.formats) {
        if (f.height && f.vcodec !== 'none') {
          heights.add(f.height);
        }
      }
    }
    const availableQualities = Array.from(heights).sort((a, b) => b - a);

    res.json({
      id: info.id || '',
      title: info.title || 'Sin título',
      uploader: info.uploader || info.channel || info.artist || 'Desconocido',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails.length ? info.thumbnails[info.thumbnails.length - 1].url : ''),
      extractor: info.extractor || info.extractor_key || '',
      webpageUrl: info.webpage_url || cleanUrl,
      availableQualities,
      platform,
    });
  } catch (parseErr) {
    console.error('JSON parse error:', parseErr);
    res.status(500).json({ error: 'Respuesta inválida del extractor yt-dlp.' });
  }
});

// 3. Start Download
app.post('/api/download', (req, res) => {
  const {
    taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    url,
    format = 'mp4',
    quality = 'best',
    customTitle,
    useCookies = true,
    userAgent,
    referer,
    headers,
  } = req.body;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'La URL es obligatoria.' });
  }

  const rawUrl = url.trim();
  const cleanUrl = normalizeMediaUrl(rawUrl);
  const isVideo = format !== 'mp3';
  const outputExtension = isVideo ? 'mp4' : 'mp3';
  const platform = detectPlatform(referer || rawUrl);

  // Check if task already running
  if (activeTasks.has(taskId) && activeTasks.get(taskId).phase !== 'completed' && activeTasks.get(taskId).phase !== 'error') {
    return res.json({ taskId, message: 'La descarga ya está en progreso.' });
  }

  // If item already downloaded and intact on disk, reuse immediately without re-downloading or file-lock conflicts
  const library = readLibrary();
  const existingItem = library.find(item => 
    item.sourceUrl === cleanUrl && 
    item.format === outputExtension && item.quality === quality &&
    path.extname(item.fileName).toLowerCase() === '.' + outputExtension &&
    fs.existsSync(path.join(DOWNLOADS_DIR, item.fileName))
  );

  if (existingItem) {
    logDebug('info', `Archivo ya existente en biblioteca: ${existingItem.fileName}. Reutilizando.`);
    const taskData = {
      taskId,
      url: cleanUrl,
      format: isVideo ? 'mp4' : 'mp3',
      quality,
      title: customTitle || existingItem.title,
      platform: platform.label,
      progress: 100,
      eta: '',
      speed: '',
      phase: 'completed',
      statusLine: '¡Descarga completada con éxito!',
      startTime: Date.now(),
      result: existingItem,
    };
    activeTasks.set(taskId, taskData);

    setTimeout(() => {
      broadcastTaskProgress(taskId, {
        progress: 100,
        phase: 'completed',
        statusLine: '¡Descarga completada con éxito!',
        result: existingItem,
      });
    }, 200);

    return res.json({
      taskId,
      message: 'Descarga completada.',
      task: taskData,
    });
  }

  if (!ffmpegReady) {
    return res.status(503).json({ error: 'FFmpeg no está disponible para preparar la descarga.' });
  }

  const outputSuffix = ' [' + randomUUID() + '].';
  const outputTemplate = path.join(DOWNLOADS_DIR, '%(title).110B' + outputSuffix + '%(ext)s');

  const args = [
    '--no-playlist',
    '--no-mtime',
    '--windows-filenames',
    '--newline',
    '--no-warnings',
    '--no-quiet',
    '--progress',
    '--print', 'after_move:mediafetch-output:%(filepath)j',
    '--socket-timeout', '15',
    ...ytdlpCommonArgs,
    '-o', outputTemplate,
  ];

  if (ffmpegReady && ffmpegPath !== 'ffmpeg') {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  if (PROXY_URL) {
    args.push('--proxy', PROXY_URL);
  }

  if (useCookies && readSessionCookies()) {
    args.push('--cookies', COOKIES_FILE);
  }

  if (userAgent && typeof userAgent === 'string') {
    args.push('--user-agent', userAgent);
  }

  if (referer && typeof referer === 'string') {
    args.push('--referer', referer);
  }

  if (headers && typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      const lower = k.toLowerCase();
      if (lower !== 'cookie' && lower !== 'user-agent' && lower !== 'referer') {
        args.push('--add-header', `${k}:${v}`);
      }
    }
  }

  // Format selection
  if (!isVideo) {
    // MP3
    const bitrate = quality === '320' ? '320K' : (quality === '128' ? '128K' : '192K');
    args.push(
      '-f', 'bestaudio/best',
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', bitrate,
      '--add-metadata'
    );
  } else {
    // MP4
    const maxHeight = ['1080', '720', '480', '360'].includes(quality) ? parseInt(quality, 10) : null;
    if (maxHeight) {
      args.push('-f', `bestvideo[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]/best`);
    } else {
      args.push('-f', 'bestvideo+bestaudio/best');
    }
    args.push('-S', 'vcodec:h264,acodec:m4a', '--recode-video', 'mp4', '--add-metadata');
  }

  // Separa la URL de las opciones de la línea de comandos, igual que en el análisis.
  args.push('--', cleanUrl);

  const taskData = {
    taskId,
    url: cleanUrl,
    format: isVideo ? 'mp4' : 'mp3',
    quality,
    title: customTitle || 'Iniciando descarga...',
    platform: platform.label,
    progress: 0,
    eta: '',
    speed: '',
    phase: 'preparing',
    statusLine: 'Iniciando proceso de descarga...',
    startTime: Date.now(),
  };

  activeTasks.set(taskId, taskData);

  // Spawn download process with closed stdin and unbuffered output to avoid container deadlocks
  const child = spawn(ytdlpRunner.cmd, [...ytdlpRunner.prefixArgs, ...args], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONUNBUFFERED: '1' }
  });
  taskData.process = child;

  let lastLine = '';
  let foundFile = '';
  let stderr = '';
  const outputLines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  const outputPrefix = 'mediafetch-output:';

  outputLines.on('line', rawLine => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith(outputPrefix)) {
      try {
        const fileName = path.basename(JSON.parse(line.slice(outputPrefix.length)));
        if (fileName.endsWith(outputSuffix + outputExtension)) foundFile = fileName;
      } catch (_) {
        logDebug('warn', 'No se pudo leer la ruta final que reportó yt-dlp.');
      }
      return;
    }
    lastLine = line;

    // Check for progress: [download]  45.2% of  ~52.12MiB at  4.12MiB/s ETA 00:06
    const progMatch = line.match(/\[download\]\s+([\d.]+)%\s+of\s+(?:~?\s*[\d.]+[A-Za-z]+)?(?:\s+at\s+([\d.]+[A-Za-z]+\/s))?(?:\s+ETA\s+([\d:]+))?/i);
    if (progMatch) {
      const percent = parseFloat(progMatch[1]);
      const speed = progMatch[2] || '';
      const eta = progMatch[3] || '';
      broadcastTaskProgress(taskId, {
        progress: percent,
        speed,
        eta,
        phase: 'downloading',
        statusLine: `Descargando: ${percent.toFixed(1)}% ${speed ? `(${speed})` : ''} ${eta ? `· Restante: ${eta}` : ''}`,
      });
      return;
    }

    // Conversion / Merger phase
    if (line.includes('[ExtractAudio]') || line.includes('[Merger]') || line.includes('ffmpeg')) {
      broadcastTaskProgress(taskId, {
        progress: 95,
        phase: 'converting',
        statusLine: isVideo ? 'Procesando y empaquetando MP4...' : 'Extrayendo audio a MP3 de alta calidad...',
      });
      return;
    }

    // Finalizing / Metadata
    if (line.includes('[Metadata]') || line.includes('Fixup') || line.includes('100% of')) {
      broadcastTaskProgress(taskId, {
        progress: 98,
        phase: 'finalizing',
        statusLine: 'Guardando metadatos y finalizando...',
      });
    }
  });

  child.stderr.on('data', chunk => {
    stderr = (stderr + chunk.toString()).slice(-8192);
    const errText = chunk.toString().trim();
    if (errText) {
      console.warn(`[yt-dlp stderr ${taskId}]:`, errText);
    }
  });

  child.on('close', (code, signal) => {
    const task = activeTasks.get(taskId);
    delete task.process;
    if (task.phase === 'error') return;

    if (signal === 'SIGTERM' || signal === 'SIGKILL' || task.cancelled) {
      broadcastTaskProgress(taskId, {
        phase: 'cancelled',
        progress: 0,
        statusLine: 'Descarga cancelada por el usuario.',
      });
      return;
    }

    if (code !== 0) {
      logDebug('error', `Descarga falló para task ${taskId} (código ${code}):`, { lastLine, stderr: stderr.trim() });
      broadcastTaskProgress(taskId, {
        phase: 'error',
        progress: 0,
        statusLine: 'Error durante la descarga.',
        errorMessage: mediaError(stderr, platform).error,
      });
      return;
    }

    if (!foundFile || !fs.existsSync(path.join(DOWNLOADS_DIR, foundFile))) {
      logDebug('error', `No se encontró archivo resultante en ${DOWNLOADS_DIR} para task ${taskId}`);
      broadcastTaskProgress(taskId, {
        phase: 'error',
        progress: 0,
        statusLine: 'No se encontró el archivo generado.',
        errorMessage: 'El archivo resultante no fue localizado en la carpeta de descargas.',
      });
      return;
    }

    const fullFilePath = path.join(DOWNLOADS_DIR, foundFile);
    const stat = fs.statSync(fullFilePath);
    const finalTitle = customTitle || foundFile.slice(0, -(outputSuffix.length + outputExtension.length));

    const libraryItem = {
      id: taskId,
      title: finalTitle,
      fileName: foundFile,
      format: isVideo ? 'mp4' : 'mp3',
      quality,
      fileSize: stat.size,
      mimeType: isVideo ? 'video/mp4' : 'audio/mpeg',
      sourceUrl: cleanUrl,
      platform: platform.label,
      downloadUrl: `/api/files/${encodeURIComponent(foundFile)}`,
      createdAt: Date.now(),
    };

    // Save to library
    const library = readLibrary();
    library.unshift(libraryItem);
    saveLibrary(library);

    logDebug('info', `Descarga finalizada con éxito: ${foundFile} (${stat.size} bytes)`);

    broadcastTaskProgress(taskId, {
      progress: 100,
      phase: 'completed',
      statusLine: '¡Descarga completada con éxito!',
      result: libraryItem,
    });
  });

  child.on('error', err => {
    delete activeTasks.get(taskId).process;
    logDebug('error', `Error al iniciar proceso yt-dlp para task ${taskId}:`, err.message);
    broadcastTaskProgress(taskId, {
      phase: 'error',
      progress: 0,
      statusLine: 'No se pudo iniciar el proceso.',
      errorMessage: err.message,
    });
  });

  res.json({
    taskId,
    message: 'Descarga iniciada.',
    task: { ...taskData, process: undefined },
  });
});

// 4. Server-Sent Events (SSE) for Real-Time Progress (Compatible with Brave Shields, Chrome, Firefox, Safari)
app.get('/api/progress/:taskId', (req, res) => {
  const { taskId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform, no-store');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevents proxy/Brave buffering
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders?.();

  // Send immediate flush comment to force unbuffering
  res.write(': connected\n\n');

  if (!sseSubscribers.has(taskId)) {
    sseSubscribers.set(taskId, new Set());
  }
  const subs = sseSubscribers.get(taskId);
  subs.add(res);

  // Send initial state immediately
  const currentTask = activeTasks.get(taskId);
  if (currentTask) {
    const safeData = { ...currentTask, process: undefined };
    res.write(`data: ${JSON.stringify(safeData)}\n\n`);
  }

  // Periodic heartbeat every 5s to keep connection alive through aggressive firewalls/shields
  const pingInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch (_) {
      clearInterval(pingInterval);
    }
  }, 5000);

  req.on('close', () => {
    clearInterval(pingInterval);
    subs.delete(res);
    if (subs.size === 0) {
      sseSubscribers.delete(taskId);
    }
  });
});

// 5. Polling endpoint for task status
app.get('/api/task/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }
  const safeData = { ...task, process: undefined };
  res.json(safeData);
});

// 6. Cancel Task
app.post('/api/cancel/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  task.cancelled = true;
  if (task.process) {
    try {
      task.process.kill('SIGTERM');
      setTimeout(() => {
        try {
          if (task.process) task.process.kill('SIGKILL');
        } catch (_) {}
      }, 1000);
    } catch (e) {
      console.error('Error killing process:', e);
    }
  }

  broadcastTaskProgress(taskId, {
    phase: 'cancelled',
    statusLine: 'Descarga cancelada por el usuario.',
  });

  res.json({ success: true, message: 'Descarga cancelada.' });
});

// 7. Library: List downloaded items
app.get('/api/library', (req, res) => {
  const items = readLibrary();
  res.json(items);
});

// 8. Serve / Stream file with Range support & direct download option (Universal browser support)
app.get('/api/files/:filename', (req, res) => {
  let rawFilename = req.params.filename;
  try {
    rawFilename = decodeURIComponent(rawFilename);
  } catch (_) {}

  const filename = path.basename(rawFilename);
  const filePath = path.join(DOWNLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    logDebug('warn', `Archivo no encontrado en /api/files/: ${filename}`);
    return res.status(404).json({ error: 'Archivo no encontrado.' });
  }

  const stat = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const isMp4 = ext === '.mp4';
  const isMp3 = ext === '.mp3';
  const contentType = isMp4 ? 'video/mp4' : (isMp3 ? 'audio/mpeg' : 'application/octet-stream');

  // If user requested direct download: send strict cross-browser RFC 5987 attachment headers (Brave, Chrome, Firefox, Edge, Safari)
  if (req.query.download === '1' || req.query.download === 'true') {
    logDebug('info', `Iniciando descarga a disco para cliente: ${filename} (${stat.size} bytes)`);

    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
    const encodedUtf8 = encodeURIComponent(filename).replace(/['()]/g, escape).replace(/\*/g, '%2A');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedUtf8}`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');

    const stream = fs.createReadStream(filePath);
    req.on('close', () => { try { stream.destroy(); } catch (_) {} });
    stream.on('error', err => {
      logDebug('error', `Error durante streaming de descarga para ${filename}:`, err.message);
      if (!res.headersSent) res.status(500).end();
    });
    return stream.pipe(res);
  }

  // Range support for HTML5 video/audio playback
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    const stream = fs.createReadStream(filePath, { start, end });
    req.on('close', () => { try { stream.destroy(); } catch (_) {} });
    stream.on('error', () => { try { stream.destroy(); } catch (_) {} });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    const stream = fs.createReadStream(filePath);
    req.on('close', () => { try { stream.destroy(); } catch (_) {} });
    stream.on('error', () => { try { stream.destroy(); } catch (_) {} });
    stream.pipe(res);
  }
});

// 9. Delete item from library
app.delete('/api/library/:id', (req, res) => {
  const { id } = req.params;
  const library = readLibrary();
  const index = library.findIndex(item => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Elemento no encontrado en la biblioteca.' });
  }

  const [removed] = library.splice(index, 1);
  saveLibrary(library);

  // Remove file from disk
  try {
    const filePath = path.join(DOWNLOADS_DIR, removed.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Error unlinking file:', err);
  }

  res.json({ success: true, removed });
});

function readSessionCookies() {
  if (!sessionCookiesEnabled) return null;

  try {
    const stat = fs.statSync(COOKIES_FILE);
    const content = fs.readFileSync(COOKIES_FILE, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim() && (!line.startsWith('#') || line.startsWith('#HttpOnly_')));
    if (lines.length === 0) return null;

    // Las versiones antiguas escribían este archivo al aceptar el aviso del sitio.
    const legacyConsent = content.includes('# MediaFetch Web — Consentimiento de Cookies Esenciales') &&
      lines.length === 3 && lines.every(line => /^\.youtube\.com\t.*\t(?:CONSENT|SOCS|PREF)\t[^\t]*$/.test(line));
    if (legacyConsent) return null;

    const hasLoginCookies = lines.some(line => /\t(SID|HSID|SSID|APISID|SAPISID|LOGIN_INFO)\t/.test(line));
    return {
      cookieCount: lines.length,
      sizeBytes: stat.size,
      updatedAt: stat.mtimeMs,
      mode: hasLoginCookies ? 'authenticated' : 'consent',
    };
  } catch (_) {
    return null;
  }
}

// 10. Session Cookies Management
app.get('/api/session/cookies', (req, res) => {
  const consentAccepted = (req.headers.cookie || '').split(';').some(cookie => cookie.trim() === 'mediafetch_cookies_accepted=1');
  const session = readSessionCookies();
  res.json({
    enabled: sessionCookiesEnabled,
    hasCookies: Boolean(session),
    consentAccepted,
    ...(session || { cookieCount: 0, sizeBytes: 0, mode: 'none' }),
  });
});

// El consentimiento de MediaFetch no crea ni modifica el archivo de sesión del extractor.
app.post('/api/session/accept-cookies', (req, res) => {
  res.setHeader('Set-Cookie', 'mediafetch_cookies_accepted=1; Path=/; Max-Age=31536000; SameSite=Lax');
  res.json({ success: true, consentAccepted: true });
});

app.post('/api/session/cookies', (req, res) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'El contenido de las cookies no puede estar vacío.' });
  }

  try {
    fs.writeFileSync(COOKIES_FILE, content.trim() + '\n', 'utf8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    res.json({
      success: true,
      hasCookies: true,
      cookieCount: lines.length,
      message: 'Cookies guardadas correctamente.',
    });
  } catch (err) {
    res.status(500).json({ error: `Error al guardar cookies: ${err.message}` });
  }
});

app.delete('/api/session/cookies', (req, res) => {
  try {
    if (fs.existsSync(COOKIES_FILE)) {
      fs.unlinkSync(COOKIES_FILE);
    }
    res.json({ success: true, message: 'Cookies eliminadas.' });
  } catch (err) {
    res.status(500).json({ error: `Error al eliminar cookies: ${err.message}` });
  }
});

// 11. Safe Web Proxy for Navegador Tab (HTML & stream inspector)
app.get('/api/proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Param "url" is required.');
  }

  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return res.status(400).send('Only http and https protocols are supported.');
    }

    const client = parsed.protocol === 'https:' ? require('https') : require('http');
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-MX,es;q=0.9,en;q=0.8',
      },
    };

    client.get(targetUrl, options, proxyRes => {
      // Follow redirect if 301/302
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        return res.redirect(`/api/proxy?url=${encodeURIComponent(proxyRes.headers.location)}`);
      }

      res.status(proxyRes.statusCode);
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (!['x-frame-options', 'content-security-policy', 'content-security-policy-report-only'].includes(k.toLowerCase())) {
          res.setHeader(k, v);
        }
      }
      proxyRes.pipe(res);
    }).on('error', err => {
      res.status(502).send(`Error al conectar con la página: ${err.message}`);
    });
  } catch (err) {
    res.status(400).send(`URL inválida: ${err.message}`);
  }
});

// 12. Update yt-dlp (Compatible with Render / Linux PEP 668 & Windows)
app.post('/api/engine/update', (req, res) => {
  // Use --break-system-packages for Debian/Bookworm PEP 668, followed by yt-dlp self-updater and standard pip
  const updateCmd = `${pythonCmd} -m pip install --upgrade --break-system-packages yt-dlp || python3 -m pip install --upgrade --break-system-packages yt-dlp || pip3 install --upgrade --break-system-packages yt-dlp || yt-dlp -U || true`;

  exec(updateCmd, (err, stdout, stderr) => {
    let newVersion = 'Actualizado';
    const recheck = detectYtdlpRunner();
    if (recheck) {
      ytdlpRunner = recheck;
      newVersion = recheck.version;
    }

    const fullOutput = `${stdout || ''} ${stderr || ''}`;
    const isSuccess = !err || fullOutput.includes('already satisfied') || fullOutput.includes('up to date') || fullOutput.includes('Successfully installed') || newVersion !== 'Actualizado';

    if (!isSuccess && err) {
      logDebug('error', 'Error al actualizar yt-dlp:', { err: err.message, stderr, stdout });
      return res.status(500).json({ error: `Error al actualizar yt-dlp: ${stderr || err.message}` });
    }

    res.json({
      success: true,
      message: `yt-dlp actualizado con éxito a la versión ${newVersion}`,
      version: newVersion,
    });
  });
});

// SPA Fallback: Serve index.html for all non-API paths
app.use((req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  const lanIps = [];
  for (const dev in ifaces) {
    for (const details of ifaces[dev]) {
      if (details.family === 'IPv4' && !details.internal && !details.address.startsWith('172.')) {
        lanIps.push(details.address);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`  🎵 MEDIAFETCH WEB — Servidor Activo y Responsivo`);
  console.log(`  🌐 Accede desde tu navegador en:`);
  console.log(`     👉 Local (esta PC): http://localhost:${PORT}`);
  lanIps.forEach(ip => {
    console.log(`     👉 Red local (celular / tablet / otra PC): http://${ip}:${PORT}`);
  });
  console.log(`  📁 Carpeta de descargas: ${DOWNLOADS_DIR}`);
  console.log(`======================================================\n`);
});
