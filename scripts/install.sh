#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  echo "Usage: $0 [--reset]"
  echo "  --reset   Recreate env files, regenerate secrets, reset fake DB, and reinstall deps"
}

RESET=0
if [[ "${1:-}" == "--reset" ]]; then
  RESET=1
elif [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

OS="$(uname -s || echo unknown)"
IS_MAC=0
IS_LINUX=0
case "$OS" in
  Darwin) IS_MAC=1 ;;
  Linux) IS_LINUX=1 ;;
esac

ensure_file_from_example() {
  local target="$1"
  local example="$2"
  if [[ $RESET -eq 1 || ! -f "$target" ]]; then
    cp "$example" "$target"
  fi
}

echo "Installing backend and frontend dependencies..."
npm install
( cd "$ROOT_DIR/dashboard/frontend" && npm install )

ensure_file_from_example ".env" ".env.example"
ensure_file_from_example "dashboard/frontend/.env" "dashboard/frontend/.env.example"

update_env_kv() {
  local file="$1"
  local key="$2"
  local value="$3"
  if grep -qE "^$key=" "$file"; then
    sed -i.bak -E "s|^$key=.*|$key=$value|g" "$file"
  else
    echo "$key=$value" >> "$file"
  fi
}

generate_secret() {
  node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"
}

for k in JWT_SECRET JWT_REFRESH_SECRET SESSION_SECRET ENCRYPTION_KEY; do
  if ! grep -qE "^$k=" ".env" || grep -qE "^$k=super-secret" ".env"; then
    update_env_kv ".env" "$k" "$(generate_secret)"
  fi
done

update_env_kv ".env" "SUPABASE_URL" "http://127.0.0.1:3001"
update_env_kv ".env" "DB_HOST" "localhost"
update_env_kv ".env" "DB_PORT" "5432"
update_env_kv ".env" "DB_NAME" "postgres"
update_env_kv ".env" "DB_USER" "supabase_admin"
update_env_kv ".env" "DB_PASSWORD" "apple_secure_2024"

if ! grep -qE "^OPENAI_API_KEY=" ".env" || [[ -z "$(grep -E '^OPENAI_API_KEY=' .env | cut -d= -f2-)" ]]; then
  echo "OPENAI_API_KEY not set. Enter your OpenAI API key (or leave blank to skip):"
  read -r -s OPENAI_INPUT || true
  echo
  if [[ -n "${OPENAI_INPUT:-}" ]]; then
    update_env_kv ".env" "OPENAI_API_KEY" "$OPENAI_INPUT"
  else
    if grep -qE "^OPENAI_API_KEY=" ".env"; then
      sed -i.bak -E "s|^OPENAI_API_KEY=.*|# OPENAI_API_KEY=|g" ".env"
    else
      echo "# OPENAI_API_KEY=" >> ".env"
    fi
  fi
fi

FAKE_DB_PATH="$ROOT_DIR/database/fake-apple-mail/fake-envelope-index.sqlite"
if [[ $IS_LINUX -eq 1 ]]; then
  if [[ $RESET -eq 1 || ! -f "$FAKE_DB_PATH" ]]; then
    npm run fake:reset
  fi
  update_env_kv ".env" "APPLE_MAIL_DB_PATH" "$FAKE_DB_PATH"
elif [[ $IS_MAC -eq 1 ]]; then
  USERNAME="$(id -un || whoami)"
  MAC_DB_PATH="/Users/${USERNAME}/Library/Mail/V10/MailData/Envelope Index"
  update_env_kv ".env" "APPLE_MAIL_DB_PATH" "$MAC_DB_PATH"
else
  if [[ ! -f "$FAKE_DB_PATH" ]]; then
    npm run fake:reset
  fi
  update_env_kv ".env" "APPLE_MAIL_DB_PATH" "$FAKE_DB_PATH"
fi

update_env_kv "dashboard/frontend/.env" "REACT_APP_API_URL" "http://localhost:8000"
update_env_kv "dashboard/frontend/.env" "REACT_APP_SUPABASE_URL" "http://127.0.0.1:3001"

PRODUCTION_VAL="$(grep -E '^PRODUCTION=' .env | cut -d= -f2- || true)"
if [[ -z "$PRODUCTION_VAL" ]]; then
  echo "Starting infrastructure (Docker Compose)..."
  docker compose up -d

  echo "Waiting for Postgres and Redis to be healthy..."
  ATTEMPTS=60
  SLEEP=2
  ok_db=0
  ok_redis=0
  for i in $(seq 1 $ATTEMPTS); do
    db_status=$(docker inspect --format='{{.State.Health.Status}}' apple_supabase_db 2>/dev/null || echo "")
    redis_status=$(docker inspect --format='{{.State.Health.Status}}' apple_redis 2>/dev/null || echo "")
    [[ "$db_status" = "healthy" ]] && ok_db=1
    [[ "$redis_status" = "healthy" ]] && ok_redis=1
    if [[ $ok_db -eq 1 && $ok_redis -eq 1 ]]; then
      break
    fi
    sleep $SLEEP
  done
  if [[ $ok_db -ne 1 || $ok_redis -ne 1 ]]; then
    echo "Infrastructure not healthy:"
    docker compose ps
    exit 1
  fi

  echo "Initializing database..."
  npm run db:init || true

  echo "Waiting for Supabase REST and Auth to be reachable..."
  for svc in rest:3001 auth:9999; do
    host_port=$(echo "$svc" | awk -F: '{print $2}')
    ok=0
    for i in $(seq 1 60); do
      if curl -sSf "http://127.0.0.1:${host_port}" -o /dev/null; then ok=1; break; fi
      sleep 2
    done
    if [[ $ok -ne 1 ]]; then
      echo "Service on port ${host_port} not reachable."
      docker compose ps || true
      exit 1
    fi
  done

  echo "Starting PM2 apps..."
  npx pm2 start ecosystem.config.js || npx pm2 restart ecosystem.config.js --update-env
fi

echo "Validating system..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health || true)
if [[ "$BACKEND_HEALTH" != "200" ]]; then
  echo "Backend health check failed (code=$BACKEND_HEALTH)."
  npx pm2 status || true
  docker compose ps || true
  exit 1
fi

if [[ -f "$FAKE_DB_PATH" ]]; then
  echo "Detected fake Apple Mail DB at $FAKE_DB_PATH"
fi

echo "Installation complete."
if [[ -z "$PRODUCTION_VAL" ]]; then
  echo "Frontend: http://localhost:3000"
  echo "Backend:  http://localhost:8000"
  echo "Health:   http://localhost:8000/api/health"
fi
