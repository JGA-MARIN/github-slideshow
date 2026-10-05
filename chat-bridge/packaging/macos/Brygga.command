#!/bin/bash
# Brygga – macOS app entry point
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESOURCES="$ROOT/Resources"
APP_SUPPORT="${HOME}/Library/Application Support/Brygga"
LOG_DIR="${APP_SUPPORT}/logs"
PORT="${BRYGGA_PORT:-3847}"
URL="http://127.0.0.1:${PORT}"

mkdir -p "$APP_SUPPORT" "$LOG_DIR"

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) NODE_DIR="$RESOURCES/node-arm64" ;;
  x86_64)
    NODE_DIR="$RESOURCES/node-x64"
    if [[ ! -x "$NODE_DIR/bin/node" ]]; then
      osascript -e 'display alert "Brygga" message "Den här installationen är byggd för Apple Silicon. Bygg om med INCLUDE_INTEL=1 eller hämta Intel-paketet." as critical'
      exit 1
    fi
    ;;
  *)
    osascript -e 'display alert "Brygga" message "Okänd processorarkitektur. Stödjer Apple Silicon (arm64) och Intel (x86_64)." as critical'
    exit 1
    ;;
esac

NODE="$NODE_DIR/bin/node"
if [[ ! -x "$NODE" ]]; then
  osascript -e 'display alert "Brygga" message "Node.js-runtime saknas i appen. Installera om Brygga från .pkg-filen." as critical'
  exit 1
fi

CONFIG_FILE="$APP_SUPPORT/config.env"
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" <<'EOF'
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
DEMO_MODE=false
EOF
fi

# shellcheck disable=SC1090
set -a
# strip Windows CR if any
source <(sed 's/\r$//' "$CONFIG_FILE")
set +a

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  KEY="$(osascript <<'APPLESCRIPT'
set dialogResult to display dialog "Välkommen till Brygga!

Klistra in din OpenAI API-nyckel för ChatGPT.
(Du kan hoppa över och köra i demoläge.)" buttons {"Hoppa över", "Spara"} default button "Spara" default answer "" with title "Brygga – setup"
if button returned of dialogResult is "Hoppa över" then
  return ""
end if
return text returned of dialogResult
APPLESCRIPT
)" || KEY=""
  if [[ -n "$KEY" ]]; then
    {
      echo "OPENAI_API_KEY=$KEY"
      echo "OPENAI_MODEL=gpt-4o-mini"
      echo "DEMO_MODE=false"
    } > "$CONFIG_FILE"
    OPENAI_API_KEY="$KEY"
    DEMO_MODE=false
  else
    {
      echo "OPENAI_API_KEY="
      echo "OPENAI_MODEL=gpt-4o-mini"
      echo "DEMO_MODE=true"
    } > "$CONFIG_FILE"
    DEMO_MODE=true
  fi
fi

export OPENAI_API_KEY="${OPENAI_API_KEY:-}"
export OPENAI_MODEL="${OPENAI_MODEL:-gpt-4o-mini}"
export DEMO_MODE="${DEMO_MODE:-false}"
export PORT
export HOSTNAME=127.0.0.1

APP_DIR="$RESOURCES/app"
cd "$APP_DIR"

# Stop previous instance if still bound to our port
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  if curl -fsS "$URL/api/status" >/dev/null 2>&1; then
    open "$URL"
    exit 0
  fi
fi

"$NODE" server.js >>"$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$APP_SUPPORT/server.pid"

for _ in $(seq 1 40); do
  if curl -fsS "$URL/api/status" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    osascript -e "display alert \"Brygga\" message \"Servern startade inte. Se logg: $LOG_DIR/server.log\" as critical"
    exit 1
  fi
  sleep 0.25
done

open "$URL"

osascript <<APPLESCRIPT
display notification "Öppnad på $URL. Ge Automatisering-behörighet till Mail och Kalender vid behov." with title "Brygga är igång"
APPLESCRIPT

# Keep the .app process alive while the server runs
while kill -0 "$SERVER_PID" 2>/dev/null; do
  sleep 5
done
