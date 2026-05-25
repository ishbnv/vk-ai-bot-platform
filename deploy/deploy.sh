#!/usr/bin/env bash
# Deploy helper для VPS.
#
# Использование (с сервера, из корня репо):
#   deploy/deploy.sh prod
#   deploy/deploy.sh dev
#
# Требования на сервере:
#   • docker + docker compose v2
#   • pnpm (для билда фронта)
#   • nginx (конфиги — в deploy/nginx/)
#   • .env.prod / .env.dev лежат в корне репо

set -euo pipefail

ENV=${1:-}
COMPOSE_FILE=docker-compose.deploy.yml
case "$ENV" in
  prod)
    ENV_FILE=.env.prod
    FRONT_DIR=/var/www/vk-ai-bot-platform/frontend
    ;;
  dev)
    ENV_FILE=.env.dev
    FRONT_DIR=/var/www/vk-ai-bot-platform-dev/frontend
    ;;
  *)
    echo "Usage: $0 {prod|dev}" >&2
    exit 1
    ;;
esac

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Скопируй из ${ENV_FILE}.example и заполни." >&2
  exit 1
fi

if [[ "${DEPLOY_SKIP_PULL:-0}" != "1" ]]; then
  echo "==> [$ENV] git pull"
  git pull --ff-only
else
  echo "==> [$ENV] skip git pull (DEPLOY_SKIP_PULL=1, выкатывает CI)"
fi

echo "==> [$ENV] pnpm install"
pnpm install --frozen-lockfile

echo "==> [$ENV] build frontend"
pnpm --filter frontend build

echo "==> [$ENV] sync frontend to $FRONT_DIR"
sudo mkdir -p "$FRONT_DIR"
sudo rsync -a --delete apps/frontend/dist/ "$FRONT_DIR/"

echo "==> [$ENV] docker compose up -d --build"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

echo "==> [$ENV] db migrate"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T backend pnpm db:migrate

# nginx-конфиги — это инфраструктура, не часть приложения. Меняются редко,
# обычно после certbot (он сам добавляет SSL-блок). Если правил deploy/nginx/*.conf
# в репо — синкни руками:
#   sudo cp deploy/nginx/vk.24finkit.ru.conf /etc/nginx/sites-available/
#   sudo certbot install --cert-name vk.24finkit.ru   # вернуть SSL
#   sudo nginx -t && sudo systemctl reload nginx

echo "==> [$ENV] done"
