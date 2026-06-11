#!/usr/bin/env bash
# 兜行 · Web 管理端 Nginx 静态站安装
#
# 用法:
#   sudo bash scripts/install-nginx-web.sh web.yxtao.site
#   sudo bash scripts/install-nginx-web.sh web.yxtao.site --certbot
#   sudo bash scripts/install-nginx-web.sh web.yxtao.site --ssl-cert /path/fullchain.pem --ssl-key /path/privkey.pem
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(WEB_NGINX_DOMAIN|STATIC_ROOT|SERVER_PORT|NGINX_CERTBOT_EMAIL)=' .env | sed 's/\r$//')
  set +a
fi

DOMAIN=""
USE_CERTBOT=false
SSL_CERT=""
SSL_KEY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --certbot)
      USE_CERTBOT=true
      shift
      ;;
    --ssl-cert)
      SSL_CERT="$2"
      shift 2
      ;;
    --ssl-key)
      SSL_KEY="$2"
      shift 2
      ;;
    -*)
      echo "[nginx:web] 未知参数: $1"
      exit 1
      ;;
    *)
      if [[ -z "$DOMAIN" ]]; then
        DOMAIN="$1"
      fi
      shift
      ;;
  esac
done

DOMAIN="${DOMAIN:-${WEB_NGINX_DOMAIN:-}}"
if [[ -z "$DOMAIN" ]]; then
  echo "[nginx:web] 请指定域名: sudo bash scripts/install-nginx-web.sh web.yxtao.site"
  exit 1
fi

STATIC_ROOT="${STATIC_ROOT:-$ROOT/static}"
SERVER_PORT="${SERVER_PORT:-3000}"
SITES_AVAILABLE="/etc/nginx/sites-available/douxing-web"
SITES_ENABLED="/etc/nginx/sites-enabled/douxing-web"
CONF_SRC="$ROOT/deploy/nginx/douxing-web.conf"

if ! command -v nginx >/dev/null 2>&1; then
  echo "[nginx:web] 未安装 Nginx，请先: apt install nginx"
  exit 1
fi

if [[ ! -f "$STATIC_ROOT/web/index.html" ]]; then
  echo "[nginx:web] 静态目录不存在: $STATIC_ROOT/web/index.html"
  echo "[nginx:web] 请先执行: pnpm deploy:release -- --target=web --skip-docker"
  exit 1
fi

if [[ -n "$SSL_CERT" && -n "$SSL_KEY" ]]; then
  if [[ ! -f "$SSL_CERT" || ! -f "$SSL_KEY" ]]; then
    echo "[nginx:web] SSL 证书路径无效"
    exit 1
  fi
  sed -e "s/__WEB_DOMAIN__/${DOMAIN}/g" \
      -e "s#__STATIC_ROOT__#${STATIC_ROOT}#g" \
      -e "s/__SERVER_PORT__/${SERVER_PORT}/g" \
      -e "s#__SSL_CERT__#${SSL_CERT}#g" \
      -e "s#__SSL_KEY__#${SSL_KEY}#g" \
      "$ROOT/deploy/nginx/douxing-web.ssl.conf.template" > "$CONF_SRC"
  echo "[nginx:web] 已生成 HTTPS 配置（自定义证书）"
else
  sed -e "s/__WEB_DOMAIN__/${DOMAIN}/g" \
      -e "s#__STATIC_ROOT__#${STATIC_ROOT}#g" \
      -e "s/__SERVER_PORT__/${SERVER_PORT}/g" \
      "$ROOT/deploy/nginx/douxing-web.conf.template" > "$CONF_SRC"
  echo "[nginx:web] 已生成 HTTP 配置"
fi

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp "$CONF_SRC" "$SITES_AVAILABLE"
ln -sf "$SITES_AVAILABLE" "$SITES_ENABLED"

nginx -t
systemctl reload nginx

echo "[nginx:web] ✓ Web 管理端已启用: http://${DOMAIN}"
echo "[nginx:web] 静态目录: ${STATIC_ROOT}/web"
echo "[nginx:web] API 反代: /api/ → 127.0.0.1:${SERVER_PORT}"

if [[ "$USE_CERTBOT" == true ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    echo "[nginx:web] 未安装 certbot，请: apt install certbot python3-certbot-nginx"
    exit 1
  fi
  CERTBOT_ARGS=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
  if [[ -n "${NGINX_CERTBOT_EMAIL:-}" ]]; then
    CERTBOT_ARGS+=(--email "$NGINX_CERTBOT_EMAIL")
  else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
  fi
  certbot "${CERTBOT_ARGS[@]}"
  nginx -t && systemctl reload nginx
  echo "[nginx:web] ✓ HTTPS 已启用: https://${DOMAIN}"
elif [[ -z "$SSL_CERT" ]]; then
  echo "[nginx:web] 若需 HTTPS: sudo bash scripts/install-nginx-web.sh ${DOMAIN} --certbot"
fi
