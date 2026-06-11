#!/usr/bin/env bash
# 兜行 · PC 用户端 Nginx 静态站安装
#
# 用法:
#   sudo bash scripts/install-nginx-pc.sh
#   sudo bash scripts/install-nginx-pc.sh pc.yxtao.site
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(PC_NGINX_DOMAIN|STATIC_ROOT|SERVER_PORT)=' .env | sed 's/\r$//')
  set +a
fi

DOMAIN="${1:-${PC_NGINX_DOMAIN:-}}"
if [[ -z "$DOMAIN" ]]; then
  echo "[nginx:pc] 请指定域名: sudo bash scripts/install-nginx-pc.sh pc.example.com"
  exit 1
fi

STATIC_ROOT="${STATIC_ROOT:-$ROOT/static}"
SERVER_PORT="${SERVER_PORT:-3000}"
SITES_AVAILABLE="/etc/nginx/sites-available/douxing-pc"
SITES_ENABLED="/etc/nginx/sites-enabled/douxing-pc"
CONF_SRC="$ROOT/deploy/nginx/douxing-pc.conf"

if ! command -v nginx >/dev/null 2>&1; then
  echo "[nginx:pc] 未安装 Nginx"
  exit 1
fi

if [[ ! -d "$STATIC_ROOT/pc" ]]; then
  echo "[nginx:pc] 静态目录不存在: $STATIC_ROOT/pc"
  echo "[nginx:pc] 请先执行: pnpm deploy:release -- --target=pc"
  exit 1
fi

sed -e "s/__PC_DOMAIN__/${DOMAIN}/g" \
    -e "s#__STATIC_ROOT__#${STATIC_ROOT}#g" \
    -e "s/__SERVER_PORT__/${SERVER_PORT}/g" \
    "$ROOT/deploy/nginx/douxing-pc.conf.template" > "$CONF_SRC"

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
cp "$CONF_SRC" "$SITES_AVAILABLE"
ln -sf "$SITES_AVAILABLE" "$SITES_ENABLED"

nginx -t
systemctl reload nginx

echo "[nginx:pc] ✓ PC 站点已启用: http://${DOMAIN}"
echo "[nginx:pc] 若需 HTTPS: sudo certbot --nginx -d ${DOMAIN}"
