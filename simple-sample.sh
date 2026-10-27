#!/usr/bin/env bash
# Local helper: ./simple-sample.sh [youtube-url]
#   With a URL: downloads the audio and opens the app with it preloaded.
#   Without:    opens the app on the import screen.
set -euo pipefail

cd "$(dirname "$0")"
IMAGE="simple-sample"
PORT="${PORT:-8080}"
DOWNLOADS="$PWD/downloads"
mkdir -p "$DOWNLOADS"

# Fall back to the system daemon if the active context (e.g. Docker Desktop) is down.
if ! docker info >/dev/null 2>&1 && [ -S /var/run/docker.sock ]; then
  export DOCKER_HOST=unix:///var/run/docker.sock
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1 || [ "${REBUILD:-0}" = "1" ]; then
  echo "» Construyendo la imagen Docker…"
  docker build -t "$IMAGE" -f docker/Dockerfile .
fi

STATE="$(mktemp -d)"
trap 'rm -rf "$STATE"; docker rm -f simple-sample >/dev/null 2>&1 || true' EXIT
docker rm -f simple-sample >/dev/null 2>&1 || true

docker run --rm --name simple-sample \
  --user "$(id -u):$(id -g)" -e HOME=/tmp \
  -p "$PORT:8080" \
  -e HOST_PORT="$PORT" \
  -e URL_FILE=/state/url \
  -e YTDLP_UPDATE="${YTDLP_UPDATE:-0}" \
  -v "$DOWNLOADS:/app/tracks" \
  -v "$STATE:/state" \
  "$IMAGE" ${1:+"$1"} &
PID=$!

# Wait until the download finished and the server answers, then open it.
for _ in $(seq 1 600); do
  if [ -s "$STATE/url" ] && curl -fs "http://localhost:$PORT/" >/dev/null 2>&1; then
    APP_URL="$(cat "$STATE/url")"
    if command -v xdg-open >/dev/null; then xdg-open "$APP_URL" >/dev/null 2>&1 &
    elif command -v open >/dev/null; then open "$APP_URL"
    fi
    break
  fi
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.5
done

echo "  (Ctrl+C para detener el servidor)"
wait "$PID"
