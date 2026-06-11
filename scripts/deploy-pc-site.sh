#!/usr/bin/env bash
# 兜行 · PC 用户端一键构建 + Nginx 部署
#
# 用法（服务器 /opt/douxing）:
#   sudo bash scripts/deploy-pc-site.sh
#   sudo bash scripts/deploy-pc-site.sh pc.yxtao.site --certbot
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
      echo "[deploy:pc-site] 未知参数: $1"
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

DOMAIN="${DOMAIN:-${PC_NGINX_DOMAIN:-pc.yxtao.site}}"
STATIC_ROOT="${STATIC_ROOT:-$ROOT/static}"

echo "[deploy:pc-site] 域名: $DOMAIN"
echo "[deploy:pc-site] 静态目录: $STATIC_ROOT/pc"

if ! grep -q '^PC_NGINX_DOMAIN=' .env 2>/dev/null; then
  echo "PC_NGINX_DOMAIN=$DOMAIN" >> .env
  echo "[deploy:pc-site] 已写入 .env: PC_NGINX_DOMAIN=$DOMAIN"
fi

if ! grep -q '^STATIC_ROOT=' .env 2>/dev/null; then
  echo "STATIC_ROOT=$STATIC_ROOT" >> .env
fi

echo "[deploy:pc-site] 构建 PC 前端..."
pnpm deploy:release -- --target=pc --skip-docker --skip-nginx

NGINX_ARGS=("$DOMAIN")
if [[ "$USE_CERTBOT" == true ]]; then
  NGINX_ARGS+=("--certbot")
fi

echo "[deploy:pc-site] 配置 Nginx..."
sudo bash scripts/install-nginx-pc.sh "${NGINX_ARGS[@]}"

echo ""
echo "[deploy:pc-site] ✓ 完成"
echo "  访问: http://${DOMAIN}$( [[ "$USE_CERTBOT" == true ]] && echo " → https://${DOMAIN}" )"
echo "  健康: curl -I http://${DOMAIN}/"
