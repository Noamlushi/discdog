#!/usr/bin/env bash
# J'GAMES — one-command dev startup.
# Brings up MongoDB, the API server (:4000) and the Next.js client (:3000),
# and rewrites the env files with this machine's *current* LAN IP so the app
# keeps working from a phone after the network changes.
#
#   ./start.sh              start everything
#   ./start.sh --seed       also (re)create the bootstrap admin account
#   ./start.sh --local      use localhost instead of the LAN IP
#   ./start.sh --stop       stop the client + server (leaves MongoDB running)
#   ./start.sh --install    force `npm install` in both packages first

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/.logs"
SERVER_PORT=4000
CLIENT_PORT=3000
MONGO_PORT=27017
MONGO_SERVICE="mongodb-community"

DO_SEED=0
DO_INSTALL=0
USE_LOCAL=0
DO_STOP=0

for arg in "$@"; do
  case "$arg" in
    --seed)    DO_SEED=1 ;;
    --install) DO_INSTALL=1 ;;
    --local)   USE_LOCAL=1 ;;
    --stop)    DO_STOP=1 ;;
    -h|--help)
      sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

# ---------- pretty output ----------
if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; C=$'\033[36m'; N=$'\033[0m'
else
  B=''; G=''; Y=''; R=''; C=''; N=''
fi
step() { printf "%s==>%s %s\n" "$C$B" "$N" "$1"; }
ok()   { printf "  %s✓%s %s\n" "$G" "$N" "$1"; }
warn() { printf "  %s!%s %s\n" "$Y" "$N" "$1"; }
die()  { printf "  %s✗%s %s\n" "$R" "$N" "$1" >&2; exit 1; }

# ---------- helpers ----------
port_pids() { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true; }

kill_port() { # $1 = port, $2 = label
  local pids; pids="$(port_pids "$1")"
  [ -z "$pids" ] && return 0
  warn "port $1 busy ($2) — stopping pid(s): $(echo "$pids" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  for _ in $(seq 1 20); do
    [ -z "$(port_pids "$1")" ] && return 0
    sleep 0.25
  done
  pids="$(port_pids "$1")"
  # shellcheck disable=SC2086
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null || true
  sleep 0.5
}

wait_for_url() { # $1 = url, $2 = seconds, $3 = label
  local i=0
  while [ "$i" -lt "$((${2} * 2))" ]; do
    if curl -fsS -m 2 -o /dev/null "$1" 2>/dev/null; then return 0; fi
    sleep 0.5; i=$((i + 1))
  done
  return 1
}

lan_ip() {
  local ip
  for iface in $(route -n get default 2>/dev/null | awk '/interface:/{print $2}') en0 en1; do
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
    [ -n "$ip" ] && { echo "$ip"; return; }
  done
  echo ""
}

# set KEY=value in a .env file (append if missing), preserving everything else
set_env() { # $1 = file, $2 = key, $3 = value
  local file="$1" key="$2" val="$3"
  touch "$file"
  if grep -qE "^${key}=" "$file"; then
    # portable in-place edit; value may contain / and : so use | as delimiter
    sed -i.tmp -E "s|^${key}=.*|${key}=${val}|" "$file" && rm -f "$file.tmp"
  else
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}

# ---------- --stop ----------
if [ "$DO_STOP" -eq 1 ]; then
  step "Stopping J'GAMES"
  kill_port "$CLIENT_PORT" "client"
  kill_port "$SERVER_PORT" "server"
  ok "client + server stopped (MongoDB left running — 'brew services stop $MONGO_SERVICE' to stop it too)"
  exit 0
fi

mkdir -p "$LOG_DIR"

# ---------- 1. MongoDB ----------
step "MongoDB"
if [ -n "$(port_pids "$MONGO_PORT")" ]; then
  ok "already listening on :$MONGO_PORT"
else
  if command -v brew >/dev/null 2>&1; then
    brew services start "$MONGO_SERVICE" >/dev/null 2>&1 || true
  else
    die "MongoDB is not running and Homebrew was not found. Start mongod manually."
  fi
  printf "  waiting for mongod"
  for _ in $(seq 1 40); do
    [ -n "$(port_pids "$MONGO_PORT")" ] && break
    printf "."; sleep 0.5
  done
  printf "\n"
  [ -n "$(port_pids "$MONGO_PORT")" ] || die "mongod did not come up on :$MONGO_PORT. Try: brew services start $MONGO_SERVICE"
  ok "started"
fi

# ---------- 2. Network address ----------
step "Network address"
IP="$(lan_ip)"
if [ "$USE_LOCAL" -eq 1 ] || [ -z "$IP" ]; then
  [ -z "$IP" ] && warn "no LAN IP found — falling back to localhost (phones won't be able to connect)"
  HOST="localhost"
else
  HOST="$IP"
  ok "LAN IP: $IP"
fi
API_URL="http://${HOST}:${SERVER_PORT}"

# ---------- 3. Env files ----------
# The API/socket URLs are baked into the client bundle, so they must match the
# address the browser actually uses. Rewriting them here is what keeps the app
# working after the machine moves to a different Wi-Fi network.
step "Env files"
SERVER_ENV="$ROOT/server/.env"
CLIENT_ENV="$ROOT/client/.env.local"

if [ ! -f "$SERVER_ENV" ]; then
  cp "$ROOT/server/.env.example" "$SERVER_ENV"
  warn "created server/.env from .env.example — check MONGODB_URI and JWT_SECRET"
fi
[ -f "$CLIENT_ENV" ] || touch "$CLIENT_ENV"

ORIGINS="http://localhost:${CLIENT_PORT}"
[ "$HOST" != "localhost" ] && ORIGINS="${ORIGINS},http://${HOST}:${CLIENT_PORT}"

set_env "$SERVER_ENV" "CLIENT_ORIGIN" "$ORIGINS"
set_env "$CLIENT_ENV" "NEXT_PUBLIC_API_URL" "$API_URL"
set_env "$CLIENT_ENV" "NEXT_PUBLIC_SOCKET_URL" "$API_URL"
ok "client → $API_URL"
ok "server CORS → $ORIGINS"

# ---------- 4. Dependencies ----------
step "Dependencies"
for pkg in server client; do
  if [ "$DO_INSTALL" -eq 1 ] || [ ! -d "$ROOT/$pkg/node_modules" ]; then
    printf "  installing %s deps...\n" "$pkg"
    (cd "$ROOT/$pkg" && npm install --no-fund --no-audit >"$LOG_DIR/$pkg-install.log" 2>&1) \
      || die "npm install failed in $pkg — see $LOG_DIR/$pkg-install.log"
    ok "$pkg installed"
  else
    ok "$pkg node_modules present"
  fi
done

# ---------- 5. Free the ports ----------
step "Ports"
kill_port "$SERVER_PORT" "server"
kill_port "$CLIENT_PORT" "client"
ok ":$SERVER_PORT and :$CLIENT_PORT free"

# ---------- 6. API server ----------
step "API server"
(cd "$ROOT/server" && npm run dev >"$LOG_DIR/server.log" 2>&1) &
SERVER_PID=$!
if wait_for_url "http://localhost:${SERVER_PORT}/health" 60 "server"; then
  ok "http://localhost:${SERVER_PORT}/health ok"
else
  echo "--- last 30 lines of $LOG_DIR/server.log ---" >&2
  tail -30 "$LOG_DIR/server.log" >&2
  die "server did not become healthy within 60s"
fi

# ---------- 7. Admin seed ----------
if [ "$DO_SEED" -eq 1 ]; then
  step "Seeding admin"
  (cd "$ROOT/server" && npm run seed:admin >"$LOG_DIR/seed.log" 2>&1) \
    && ok "admin seeded (see $LOG_DIR/seed.log)" \
    || warn "seed failed — see $LOG_DIR/seed.log"
fi

# ---------- 8. Client ----------
step "Client"
(cd "$ROOT/client" && npm run dev >"$LOG_DIR/client.log" 2>&1) &
CLIENT_PID=$!
if wait_for_url "http://localhost:${CLIENT_PORT}/" 120 "client"; then
  ok "http://localhost:${CLIENT_PORT} ok"
else
  echo "--- last 30 lines of $LOG_DIR/client.log ---" >&2
  tail -30 "$LOG_DIR/client.log" >&2
  die "client did not respond within 120s"
fi

# ---------- shutdown ----------
cleanup() {
  echo
  step "Shutting down"
  kill "$CLIENT_PID" "$SERVER_PID" 2>/dev/null || true
  kill_port "$CLIENT_PORT" "client"
  kill_port "$SERVER_PORT" "server"
  ok "stopped (MongoDB left running)"
}
trap cleanup EXIT INT TERM

# ---------- ready ----------
echo
printf "%sJ'GAMES is up%s\n" "$G$B" "$N"
printf "  %sApp:%s      http://localhost:%s\n" "$B" "$N" "$CLIENT_PORT"
printf "  %sAPI:%s      http://localhost:%s\n" "$B" "$N" "$SERVER_PORT"
if [ "$HOST" != "localhost" ]; then
  printf "  %sPhone:%s    http://%s:%s   (same Wi-Fi)\n" "$B" "$N" "$HOST" "$CLIENT_PORT"
fi
printf "  %sLogs:%s     %s/{server,client}.log\n" "$B" "$N" "$LOG_DIR"
printf "\n  Press %sCtrl+C%s to stop.\n\n" "$B" "$N"

wait
