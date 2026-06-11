#!/usr/bin/env bash
# 兜行 · Web 管理端一键构建 + Nginx 部署
#
# 用法（服务器 /opt/douxing）:
#   bash scripts/deploy-web-site.sh
#   bash scripts/deploy-web-site.sh web.yxtao.site --certbot
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN=""
USE_CERTBOT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --certbot)
      USE_CERTBOT=true
      shift
      ;;
    -*)
      echo "[deploy:web-site] 未知参数: $1"
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

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DOMAIN="${DOMAIN:-${WEB_NGINX_DOMAIN:-web.yxtao.site}}"
STATIC_ROOT="${STATIC_ROOT:-$ROOT/static}"
WEB_DIST="$STATIC_ROOT/web"

echo "[deploy:web-site] 域名: $DOMAIN"
echo "[deploy:web-site] 静态目录: $WEB_DIST"

if [[ -f .env ]]; then
  grep -q '^WEB_NGINX_DOMAIN=' .env || echo "WEB_NGINX_DOMAIN=$DOMAIN" >> .env
  grep -q '^STATIC_ROOT=' .env || echo "STATIC_ROOT=$STATIC_ROOT" >> .env
fi

echo "[deploy:web-site] 构建 Web 管理端（含 shared，约 3～10 分钟）..."
pnpm --filter @douxing/shared build
pnpm build:web

mkdir -p "$WEB_DIST"
rm -rf "${WEB_DIST:?}/"*
cp -r packages/web/dist/. "$WEB_DIST/"
echo "[deploy:web-site] ✓ 静态已发布 → $WEB_DIST"

if [[ ! -f "$WEB_DIST/index.html" ]]; then
  echo "[deploy:web-site] ✗ 构建产物缺失: $WEB_DIST/index.html"
  exit 1
fi

NGINX_ARGS=("$DOMAIN")
if [[ "$USE_CERTBOT" == true ]]; then
  NGINX_ARGS+=("--certbot")
fi

echo "[deploy:web-site] 配置 Nginx..."
sudo bash scripts/install-nginx-web.sh "${NGINX_ARGS[@]}"

echo ""
echo "[deploy:web-site] ✓ 完成"
echo "  访问: https://${DOMAIN}/"
