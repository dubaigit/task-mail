#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Checking Node and npm..."
node -v
npm -v

echo "Installing backend dependencies..."
npm install

echo "Installing frontend dependencies..."
cd "$ROOT_DIR/dashboard/frontend"
npm install
cd "$ROOT_DIR"

if [ ! -f ".env" ]; then
  echo "Creating backend .env from example..."
  cp .env.example .env
fi

if [ ! -f "dashboard/frontend/.env" ]; then
  echo "Creating frontend .env from example..."
  cp dashboard/frontend/.env.example dashboard/frontend/.env
fi

FAKE_DB_PATH="$ROOT_DIR/database/fake-apple-mail/fake-envelope-index.sqlite"
if [ ! -f "$FAKE_DB_PATH" ]; then
  echo "Generating fake Apple Mail database..."
  npm run fake:reset
fi

echo "Ensuring APPLE_MAIL_DB_PATH is set..."
if ! grep -q '^APPLE_MAIL_DB_PATH=' .env; then
  echo "APPLE_MAIL_DB_PATH=$FAKE_DB_PATH" >> .env
fi

echo "Starting infrastructure with docker compose..."
docker compose up -d

echo "Waiting for Postgres and Redis to be healthy..."
ATTEMPTS=60
SLEEP=2
ok_db=0
ok_redis=0
for i in $(seq 1 $ATTEMPTS); do
  db_status=$(docker inspect --format='{{.State.Health.Status}}' apple_supabase_db 2>/dev/null || echo "")
  redis_status=$(docker inspect --format='{{.State.Health.Status}}' apple_redis 2>/dev/null || echo "")
  if [ "$db_status" = "healthy" ]; then ok_db=1; fi
  if [ "$redis_status" = "healthy" ]; then ok_redis=1; fi
  if [ $ok_db -eq 1 ] && [ $ok_redis -eq 1 ]; then
    break
  fi
  sleep $SLEEP
done
if [ $ok_db -ne 1 ] || [ $ok_redis -ne 1 ]; then
  echo "Infrastructure not healthy. Current status:"
  docker compose ps
  exit 1
fi

echo "Initializing database..."
npm run db:init || true

echo "Starting PM2 apps..."
npx pm2 start ecosystem.config.js || npx pm2 restart ecosystem.config.js --update-env

echo "Checking backend health..."
ATTEMPTS=30
for i in $(seq 1 $ATTEMPTS); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/health || true)
  if [ "$code" = "200" ]; then
    echo "Backend healthy."
    break
  fi
  sleep 1
done
if [ "$code" != "200" ]; then
  echo "Backend not healthy. Last PM2 status:"
  npx pm2 status
  exit 1
fi

echo "All set. Frontend: http://localhost:3000  Backend health: http://localhost:8000/api/health"
