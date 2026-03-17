#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/cms}"
DOMAIN="${DOMAIN:-app.144-91-77-107.sslip.io}"
NGINX_AVAILABLE_DIR="${NGINX_AVAILABLE_DIR:-/etc/nginx/sites-available}"
NGINX_ENABLED_DIR="${NGINX_ENABLED_DIR:-/etc/nginx/sites-enabled}"
NGINX_CONF_NAME="${NGINX_CONF_NAME:-app.144-91-77-107.sslip.io.conf}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

mkdir -p "${APP_DIR}"
cp docker-compose.prod.yml "${APP_DIR}/docker-compose.yml"
cp deploy/nginx/${NGINX_CONF_NAME} "${NGINX_AVAILABLE_DIR}/${NGINX_CONF_NAME}"
ln -sfn "${NGINX_AVAILABLE_DIR}/${NGINX_CONF_NAME}" "${NGINX_ENABLED_DIR}/${NGINX_CONF_NAME}"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp .env.production.example "${APP_DIR}/.env"
  echo "Created ${APP_DIR}/.env from .env.production.example. Edit it before first run if needed."
fi

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" config -q

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" build --pull

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" up -d --remove-orphans

for i in {1..30}; do
  status="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' minicms-app 2>/dev/null || true)"
  if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
    break
  fi
  if [[ "${i}" -eq 30 ]]; then
    echo "Container minicms-app did not become healthy in time."
    docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" logs --tail=120 app || true
    exit 1
  fi
  sleep 2
done

nginx -t
systemctl reload nginx

if [[ -n "${CERTBOT_EMAIL}" ]]; then
  if certbot certificates | grep -q "Domains:.*${DOMAIN}"; then
    certbot --nginx --non-interactive --agree-tos --email "${CERTBOT_EMAIL}" --expand -d "${DOMAIN}"
  else
    certbot --nginx --non-interactive --agree-tos --email "${CERTBOT_EMAIL}" -d "${DOMAIN}"
  fi
else
  echo "CERTBOT_EMAIL not provided, skipping certbot certificate management."
fi

nginx -t
systemctl reload nginx

echo "Deployment finished for ${DOMAIN}."
