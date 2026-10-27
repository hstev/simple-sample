#!/bin/sh
# Usage: entrypoint.sh [youtube-url]
set -eu

PORT="${PORT:-8080}"
HOST_PORT="${HOST_PORT:-$PORT}"
URL="${1:-}"
APP="http://localhost:${HOST_PORT}/"

if [ "${YTDLP_UPDATE:-0}" = "1" ]; then
  echo "» Actualizando yt-dlp…"
  # Non-root (simple-sample.sh runs as the host user): install into the user site.
  USERFLAG=""; [ "$(id -u)" != "0" ] && USERFLAG="--user"
  pip install --no-cache-dir -q -U $USERFLAG "yt-dlp[default]" || echo "  (no se pudo actualizar, sigo con la versión instalada)"
fi

if [ -n "$URL" ]; then
  echo "» Descargando audio: $URL"
  OUT="$(mktemp)"
  yt-dlp \
    --no-playlist --no-cache-dir \
    --extract-audio --audio-format mp3 --audio-quality 0 \
    --restrict-filenames \
    --output "/app/tracks/%(title).80s.%(ext)s" \
    --print-to-file after_move:filepath "$OUT" \
    --quiet --no-warnings --progress \
    "$URL" || true
  echo ""
  FILE="$(tail -n 1 "$OUT")"
  rm -f "$OUT"
  if [ -n "$FILE" ] && [ -f "$FILE" ]; then
    NAME=$(basename "$FILE")
    ENCODED=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$NAME")
    APP="${APP}?track=tracks/${ENCODED}"
    echo "✓ Descargado: $NAME"
  else
    echo "✗ No se pudo descargar el audio. Abre la app e importa un MP3 manualmente."
  fi
fi

echo ""
echo "  Simple Sample listo →  $APP"
echo ""
[ -n "${URL_FILE:-}" ] && echo "$APP" > "$URL_FILE"

exec python3 -m http.server "$PORT" --directory /app --bind 0.0.0.0
