"""
MediaFetch Web — Standalone Python Server Option
Ejecutar con: python server.py
"""

import os
import sys
import json
import time
import urllib.parse
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
import yt_dlp
import imageio_ffmpeg

PORT = 3000
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOADS_DIR = os.path.join(ROOT_DIR, "downloads")
SESSION_DIR = os.path.join(ROOT_DIR, "session")
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
METADATA_FILE = os.path.join(DOWNLOADS_DIR, "metadata.json")
COOKIES_FILE = os.path.join(SESSION_DIR, "cookies.txt")

os.makedirs(DOWNLOADS_DIR, exist_ok=True)
os.makedirs(SESSION_DIR, exist_ok=True)
if not os.path.exists(METADATA_FILE):
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump([], f)

FFMPEG_PATH = imageio_ffmpeg.get_ffmpeg_exe()
print(f"[MediaFetch Python] FFMPEG detectado en: {FFMPEG_PATH}")

active_tasks = {}
tasks_lock = threading.Lock()

def read_library():
    try:
        if not os.path.exists(METADATA_FILE):
            return []
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            items = json.load(f)
        return [item for item in items if os.path.exists(os.path.join(DOWNLOADS_DIR, item.get("fileName", "")))]
    except Exception:
        return []

def save_library(items):
    try:
        with open(METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump(items, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print("Error saving library:", e)

class MediaFetchHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if path == "/api/status":
            self.send_json({
                "initialized": True,
                "ytdlpVersion": yt_dlp.version.__version__,
                "ffmpegReady": True,
                "ffmpegPath": FFMPEG_PATH,
                "hasCookies": os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 0,
                "totalDownloads": len(read_library()),
                "downloadsDir": DOWNLOADS_DIR,
                "pythonVersion": sys.version,
            })
            return

        elif path.startswith("/api/task/"):
            task_id = path.replace("/api/task/", "")
            with tasks_lock:
                task = active_tasks.get(task_id)
            if not task:
                self.send_error(404, "Tarea no encontrada")
                return
            self.send_json(task)
            return

        elif path == "/api/library":
            self.send_json(read_library())
            return

        elif path.startswith("/api/files/"):
            file_name = urllib.parse.unquote(path.replace("/api/files/", ""))
            file_path = os.path.join(DOWNLOADS_DIR, os.path.basename(file_name))
            if not os.path.exists(file_path):
                self.send_error(404, "Archivo no encontrado")
                return

            stat = os.stat(file_path)
            is_mp4 = file_name.lower().endswith(".mp4")
            content_type = "video/mp4" if is_mp4 else "audio/mpeg"

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(stat.st_size))
            if "download" in query:
                self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(file_name)}"')
            self.end_headers()

            with open(file_path, "rb") as f:
                while chunk := f.read(64 * 1024):
                    self.wfile.write(chunk)
            return

        elif path == "/api/session/cookies":
            if not os.path.exists(COOKIES_FILE) or os.path.getsize(COOKIES_FILE) == 0:
                self.send_json({"hasCookies": False, "cookieCount": 0})
                return
            with open(COOKIES_FILE, "r", encoding="utf-8") as f:
                lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]
            self.send_json({"hasCookies": True, "cookieCount": len(lines)})
            return

        # Default static files
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else ""
        data = json.loads(body) if body else {}

        if path == "/api/analyze":
            url = data.get("url", "").strip()
            if not url:
                self.send_error(400, "URL requerida")
                return

            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "ffmpeg_location": FFMPEG_PATH,
            }
            if os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 0:
                ydl_opts["cookiefile"] = COOKIES_FILE

            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info = ydl.extract_info(url, download=False)
                    formats = info.get("formats", [])
                    heights = sorted(list({f.get("height") for f in formats if f.get("height")}), reverse=True)

                    res = {
                        "id": info.get("id", ""),
                        "title": info.get("title", "Sin título"),
                        "uploader": info.get("uploader", info.get("channel", "Desconocido")),
                        "duration": info.get("duration", 0),
                        "thumbnail": info.get("thumbnail", ""),
                        "extractor": info.get("extractor", ""),
                        "webpageUrl": info.get("webpage_url", url),
                        "availableQualities": heights,
                    }
                    self.send_json(res)
            except Exception as e:
                self.send_error(422, str(e))
            return

        elif path == "/api/download":
            task_id = data.get("taskId") or f"py_{int(time.time())}"
            url = data.get("url", "").strip()
            fmt = data.get("format", "mp4").lower()
            quality = data.get("quality", "best")
            custom_title = data.get("customTitle")

            threading.Thread(
                target=self.run_download_task,
                args=(task_id, url, fmt, quality, custom_title),
                daemon=True
            ).start()

            self.send_json({"taskId": task_id, "message": "Descarga iniciada en segundo plano"})
            return

        elif path == "/api/session/cookies":
            content = data.get("content", "").strip()
            with open(COOKIES_FILE, "w", encoding="utf-8") as f:
                f.write(content + "\n")
            lines = [l for l in content.splitlines() if l.strip() and not l.startswith("#")]
            self.send_json({"success": True, "hasCookies": True, "cookieCount": len(lines)})
            return

        self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path.startswith("/api/library/"):
            item_id = path.replace("/api/library/", "")
            items = read_library()
            remaining = []
            for item in items:
                if item.get("id") == item_id:
                    file_path = os.path.join(DOWNLOADS_DIR, item.get("fileName", ""))
                    if os.path.exists(file_path):
                        os.remove(file_path)
                else:
                    remaining.append(item)
            save_library(remaining)
            self.send_json({"success": True})
            return

        elif path == "/api/session/cookies":
            if os.path.exists(COOKIES_FILE):
                os.remove(COOKIES_FILE)
            self.send_json({"success": True})
            return

        self.send_error(404)

    def run_download_task(self, task_id, url, fmt, quality, custom_title):
        is_video = fmt != "mp3"
        task_data = {
            "taskId": task_id,
            "url": url,
            "format": "mp4" if is_video else "mp3",
            "progress": 0,
            "phase": "downloading",
            "statusLine": "Iniciando descarga...",
            "title": custom_title or url,
        }
        with tasks_lock:
            active_tasks[task_id] = task_data

        def progress_hook(d):
            if d["status"] == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes", 0)
                pct = (downloaded / total * 100) if total > 0 else 0
                task_data["progress"] = pct
                task_data["statusLine"] = f"Descargando: {pct:.1f}%"
            elif d["status"] == "finished":
                task_data["progress"] = 98
                task_data["phase"] = "finalizing"
                task_data["statusLine"] = "Finalizando y guardando..."

        out_template = os.path.join(DOWNLOADS_DIR, "%(title).110B.%(ext)s")
        ydl_opts = {
            "outtmpl": out_template,
            "ffmpeg_location": FFMPEG_PATH,
            "progress_hooks": [progress_hook],
            "quiet": True,
            "no_warnings": True,
        }
        if os.path.exists(COOKIES_FILE) and os.path.getsize(COOKIES_FILE) > 0:
            ydl_opts["cookiefile"] = COOKIES_FILE

        if not is_video:
            bitrate = "320" if quality == "320" else ("128" if quality == "128" else "192")
            ydl_opts.update({
                "format": "bestaudio/best",
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": bitrate,
                }],
            })
        else:
            if quality in ["1080", "720", "480", "360"]:
                ydl_opts["format"] = f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]/best"
            else:
                ydl_opts["format"] = "bestvideo+bestaudio/best"
            ydl_opts["merge_output_format"] = "mp4"

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                final_name = ydl.prepare_filename(info)
                if not is_video:
                    final_name = os.path.splitext(final_name)[0] + ".mp3"

                basename = os.path.basename(final_name)
                stat = os.stat(os.path.join(DOWNLOADS_DIR, basename))

                lib_item = {
                    "id": task_id,
                    "title": custom_title or info.get("title", basename),
                    "fileName": basename,
                    "format": "mp4" if is_video else "mp3",
                    "quality": quality,
                    "fileSize": stat.st_size,
                    "mimeType": "video/mp4" if is_video else "audio/mpeg",
                    "sourceUrl": url,
                    "platform": info.get("extractor", "Web"),
                    "downloadUrl": f"/api/files/{urllib.parse.quote(basename)}",
                    "createdAt": int(time.time() * 1000),
                }

                lib = read_library()
                lib.insert(0, lib_item)
                save_library(lib)

                task_data["progress"] = 100
                task_data["phase"] = "completed"
                task_data["statusLine"] = "Completado"
                task_data["result"] = lib_item
        except Exception as e:
            task_data["phase"] = "error"
            task_data["statusLine"] = f"Error: {str(e)}"

    def send_json(self, data):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), MediaFetchHandler)
    print(f"\n======================================================")
    print(f"  🎵 MEDIAFETCH WEB (Python Server) — 100% Responsivo")
    print(f"  🌐 Abre tu navegador en: http://localhost:{PORT}")
    print(f"  📁 Guardando en: {DOWNLOADS_DIR}")
    print(f"======================================================\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")

