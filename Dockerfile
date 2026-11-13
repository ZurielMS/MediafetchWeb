FROM node:20-bookworm-slim

# Install Python, pip, ffmpeg and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp globally
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

# Install Node production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source
COPY . .

# Ensure storage directories exist
RUN mkdir -p downloads session

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
