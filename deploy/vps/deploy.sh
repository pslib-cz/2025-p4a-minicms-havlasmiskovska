#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/cms}"
DOMAIN="${DOMAIN:-cms.144-91-77-107.sslip.io}"
NGINX_AVAILABLE_DIR="${NGINX_AVAILABLE_DIR:-/etc/nginx/sites-available}"
NGINX_ENABLED_DIR="${NGINX_ENABLED_DIR:-/etc/nginx/sites-enabled}"
NGINX_CONF_NAME="${NGINX_CONF_NAME:-cms.144-91-77-107.sslip.io.conf}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
CERTBOT_DOMAINS="${CERTBOT_DOMAINS:-${DOMAIN}}"
NGINX_MANAGED=0

mkdir -p "${APP_DIR}"
cp docker-compose.prod.yml "${APP_DIR}/docker-compose.yml"

if [[ -d "${NGINX_AVAILABLE_DIR}" ]]; then
  cp "deploy/nginx/${NGINX_CONF_NAME}" "${NGINX_AVAILABLE_DIR}/${NGINX_CONF_NAME}"
  if [[ -d "${NGINX_ENABLED_DIR}" ]]; then
    ln -sfn "${NGINX_AVAILABLE_DIR}/${NGINX_CONF_NAME}" "${NGINX_ENABLED_DIR}/${NGINX_CONF_NAME}"
  fi
  NGINX_MANAGED=1
elif [[ -d "/etc/nginx/conf.d" ]]; then
  echo "${NGINX_AVAILABLE_DIR} not found, using /etc/nginx/conf.d instead."
  cp "deploy/nginx/${NGINX_CONF_NAME}" "/etc/nginx/conf.d/${NGINX_CONF_NAME}"
  NGINX_MANAGED=1
elif [[ -d "/usr/local/nginx/conf/conf.d" ]]; then
  echo "Using /usr/local/nginx/conf/conf.d for nginx config."
  cp "deploy/nginx/${NGINX_CONF_NAME}" "/usr/local/nginx/conf/conf.d/${NGINX_CONF_NAME}"
  NGINX_MANAGED=1
elif [[ -d "/usr/local/openresty/nginx/conf/conf.d" ]]; then
  echo "Using /usr/local/openresty/nginx/conf/conf.d for nginx config."
  cp "deploy/nginx/${NGINX_CONF_NAME}" "/usr/local/openresty/nginx/conf/conf.d/${NGINX_CONF_NAME}"
  NGINX_MANAGED=1
else
  echo "No supported nginx config directory found. Skipping nginx/certbot management in this deploy run."
fi

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp .env.production.example "${APP_DIR}/.env"
  echo "Created ${APP_DIR}/.env from .env.production.example. Edit it before first run if needed."
fi

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" config -q

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" build --pull

docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" up -d --remove-orphans

max_attempts=120
ready=0
for i in $(seq 1 "${max_attempts}"); do
  running="$(docker inspect --format='{{.State.Running}}' minicms-app 2>/dev/null || echo false)"
  health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' minicms-app 2>/dev/null || echo unknown)"

  if [[ "${running}" != "true" ]]; then
    sleep 2
    continue
  fi

  if command -v curl >/dev/null 2>&1; then
    http_code="$(curl -sS -o /dev/null -m 2 -w "%{http_code}" http://127.0.0.1:3001/ || echo 000)"
  else
    http_code="$(docker exec minicms-app node -e "fetch('http://127.0.0.1:3000/').then((r)=>process.stdout.write(String(r.status))).catch(()=>process.stdout.write('000'))" 2>/dev/null || echo 000)"
  fi

  if [[ "${http_code}" =~ ^[0-9]{3}$ ]] && [[ "${http_code}" -lt 500 ]] && [[ "${http_code}" -ne 000 ]]; then
    echo "Container minicms-app responded with HTTP ${http_code}; continuing deployment."
    ready=1
    break
  fi

  if [[ "${health}" == "healthy" ]]; then
    echo "Container minicms-app is healthy; continuing deployment."
    ready=1
    break
  fi

  sleep 2
done

if [[ "${ready}" -ne 1 ]]; then
  echo "Container minicms-app did not become ready in time."
  docker inspect minicms-app --format='running={{.State.Running}} status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' || true
  docker compose -f "${APP_DIR}/docker-compose.yml" --env-file "${APP_DIR}/.env" logs --tail=120 app || true
  exit 1
fi

if [[ "${NGINX_MANAGED}" -eq 1 ]] && command -v nginx >/dev/null 2>&1; then
  nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx
  fi
fi

if [[ -n "${CERTBOT_EMAIL}" ]] && [[ "${NGINX_MANAGED}" -eq 1 ]] && command -v certbot >/dev/null 2>&1; then
  IFS=',' read -r -a cert_domains <<< "${CERTBOT_DOMAINS}"
  certbot_domain_args=()
  for domain in "${cert_domains[@]}"; do
    if [[ -n "${domain}" ]]; then
      certbot_domain_args+=("-d" "${domain}")
    fi
  done

  if [[ ${#certbot_domain_args[@]} -eq 0 ]]; then
    echo "No domains configured for certbot, skipping certbot step."
  elif certbot certificates | grep -q "Domains:.*${cert_domains[0]}"; then
    certbot --nginx --non-interactive --agree-tos --email "${CERTBOT_EMAIL}" --expand "${certbot_domain_args[@]}"
  else
    certbot --nginx --non-interactive --agree-tos --email "${CERTBOT_EMAIL}" "${certbot_domain_args[@]}"
  fi
elif [[ -n "${CERTBOT_EMAIL}" ]]; then
  echo "CERTBOT_EMAIL provided, but nginx/certbot auto-management is unavailable on this host; skipping certbot step."
else
  echo "CERTBOT_EMAIL not provided, skipping certbot certificate management."
fi

if [[ "${NGINX_MANAGED}" -eq 1 ]] && command -v nginx >/dev/null 2>&1; then
  nginx -t
  if command -v systemctl >/dev/null 2>&1; then
    systemctl reload nginx
  fi
fi

echo "Deployment finished for ${DOMAIN}."
