#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

IMAGE="${IMAGE:-daymark}"
NAME="${NAME:-daymark}"
HOST_PORT="${HOST_PORT:-7001}"

docker build -t "$IMAGE" .
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$NAME" \
  --restart unless-stopped \
  -p "${HOST_PORT}:7001" \
  -e HOST=0.0.0.0 \
  -e PORT=7001 \
  "$IMAGE"

echo "Daymark is listening on http://127.0.0.1:${HOST_PORT}"
