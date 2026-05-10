#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PY="$ROOT_DIR/venv/bin/python"
VENV_UVICORN="$ROOT_DIR/venv/bin/uvicorn"
BACKEND_PORT=8000
FRONTEND_PORT=5500
FRONTEND_DIR="$ROOT_DIR/frontend/out"

if [[ ! -x "$VENV_PY" || ! -x "$VENV_UVICORN" ]]; then
  echo "Error: venv tools not found. Expected: $ROOT_DIR/venv/bin/python and uvicorn"
  exit 1
fi

free_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "Port $port is in use. Stopping existing process(es): $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
      echo "Force stopping process(es) on port $port: $pids"
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"

echo "Starting backend on http://127.0.0.1:${BACKEND_PORT}"
"$VENV_UVICORN" backend.main:app --host 0.0.0.0 --port "$BACKEND_PORT" > "$ROOT_DIR/.backend.log" 2>&1 &
BACKEND_PID=$!

sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
  echo "Backend failed to start. Check $ROOT_DIR/.backend.log"
  exit 1
fi

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend export not found at $FRONTEND_DIR. Run: cd $ROOT_DIR/frontend && npm run build"
  exit 1
fi

LAN_IP=$(ifconfig en0 2>/dev/null | awk '/inet / {print $2}' | head -n 1)
if [[ -z "${LAN_IP:-}" ]]; then
  LAN_IP=$(ifconfig en1 2>/dev/null | awk '/inet / {print $2}' | head -n 1)
fi

echo "Starting frontend on http://127.0.0.1:${FRONTEND_PORT}"
if [[ -n "${LAN_IP:-}" ]]; then
  echo "Phone URL: http://${LAN_IP}:${FRONTEND_PORT}"
  echo "Backend URL: http://${LAN_IP}:${BACKEND_PORT}"
else
  echo "Could not detect LAN IP automatically. Use your Mac's Wi-Fi IP address."
fi

exec "$VENV_PY" -m http.server "$FRONTEND_PORT" --bind 0.0.0.0 --directory "$FRONTEND_DIR"
