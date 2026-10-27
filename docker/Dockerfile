# Optional local helper: downloads audio with yt-dlp and serves the static
# build with the track preloaded. The web app itself needs none of this.

# ---- 1. Build the static app ----
FROM node:22-alpine AS web
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN VITE_BASE=./ npm run build

# ---- 2. JS runtime required by yt-dlp for YouTube ----
FROM denoland/deno:bin AS deno

# ---- 3. Runtime: yt-dlp + ffmpeg + a plain static file server ----
FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir -U "yt-dlp[default]"
COPY --from=deno /deno /usr/local/bin/deno
WORKDIR /app
COPY --from=web /src/dist/ ./
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh && mkdir -p /app/tracks && chmod 777 /app/tracks
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["entrypoint.sh"]
