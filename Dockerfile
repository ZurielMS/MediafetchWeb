# Node 24 sirve la aplicación y ejecuta el JavaScript que necesita yt-dlp.
FROM node:24-bookworm-slim

# La imagen instala FFmpeg para que el despliegue pueda convertir audio y video.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# La variante [default] incluye los componentes JavaScript de yt-dlp para YouTube.
# La compilación comprueba que esos componentes y FFmpeg estén disponibles.
ENV PATH="/opt/yt-dlp/bin:$PATH"
RUN python3 -m venv /opt/yt-dlp \
    && python -m pip install --no-cache-dir 'yt-dlp[default]' \
    && python -c 'import yt_dlp_ejs' \
    && yt-dlp --version \
    && ffmpeg -version

WORKDIR /app

# Usa el archivo de bloqueo para reproducir las dependencias de Node.
# Se omite el postinstall porque yt-dlp ya está instalado en la imagen.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy application source
COPY . .

# Ensure storage directories exist
RUN mkdir -p downloads session

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]

