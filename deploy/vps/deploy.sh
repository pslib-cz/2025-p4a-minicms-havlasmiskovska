#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/minicms-app}"
DOMAIN="${DOMAIN:-app.144-91-77-107.sslip.io}"
NGINX_AVAILABLE_DIR="${NGINX_AVAILABLE_DIR:-/etc/nginx/sites-available}"
NGINX_ENABLED_DIR="${NGINX_ENABLED_DIR:-/etc/nginx/sites-enabled}"
NGINX_CONF_NAME="${NGINX_CONF_NAME:-app.144-91-77-107.sslip.io.conf}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:?CERTBOT_EMAIL is required}"
GHCR_USERNAME="${GHCR_USERNAME:?GHCR_USERNAME is required}"
GHCR_TOKEN="${GHCR_TOKEN:?GHCR_TOKEN is required}"

mkdir -p "${APP_DIR}" "${APP_DIR}/data"
cp docker-compose.prod.yml "${APP_DIR}/docker-compose.yml"
cp deploy/nginx/${NGINX_CONF_NAME} "${NGINX_AVAILABLE_DIR}/${NGINX_CONF_NAME}"
ln -sfn "${NGINX_AVAILABLE_DIR}/${NGINX_CONF_NAME}" "${NGINX_ENABLED_DIR}/${NGINX_CONF_NAME}"

if ! docker network inspect proxy-network >/dev/null 2>&1; then
  docker network create proxy-network
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp .env.production.example "${APP_DIR}/.env"
  echo "Created ${APP_DIR}/.env from .env.production.example. Edit it before first run if needed."
fi

docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin <<< "${GHCR_TOKEN}"

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" pull

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" up -d --remove-orphans

nginx -t
systemctl reload nginx

if certbot certificates | grep -q "Domains:.*${DOMAIN}"; then
  certbot --nginx --non-interactive --agree-tos --email "${CERTBOT_EMAIL}" --expand -d "${DOMAIN}"
else
  certbot --nginx --non-interactive --agree-tos --email "${CERTBOT_EMAIL}" -d "${DOMAIN}"
fi

nginx -t
systemctl reload nginx

echo "Deployment finished for ${DOMAIN}."
