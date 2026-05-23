#!/usr/bin/env bash
# 兜行 · Nginx 自动安装（由 deploy:server 调用，可单独 sudo 执行）
# - HTTPS 已通 → 跳过
# - 已有 SSL 配置 → 仅 reload，不覆盖 Certbot 改过的文件
# - Let's Encrypt 证书已存在 → 安装 SSL 反代配置
# - 否则 → HTTP 反代；若 .env 有 NGINX_CERTBOT_EMAIL 则自动 certbot
#
# 用法:
#   sudo bash scripts/install-nginx-auto.sh
#   sudo bash scripts/install-nginx-auto.sh api.yxtao.site you@example.com
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# 读取 .env
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(API_PUBLIC_BASE_URL|NGINX_DOMAIN|SERVER_PORT|NGINX_CERTBOT_EMAIL)=' .env | sed 's/\r$//')
  set +a
fi

DOMAIN="${1:-${NGINX_DOMAIN:-}}"
if [[ -z "$DOMAIN" && -n "${API_PUBLIC_BASE_URL:-}" ]]; then
  DOMAIN="$(echo "$API_PUBLIC_BASE_URL" | sed -E 's#^https?://([^/]+).*#\1#')"
fi
DOMAIN="${DOMAIN:-api.yxtao.site}"
CERTBOT_EMAIL="${2:-${NGINX_CERTBOT_EMAIL:-}}"
SERVER_PORT="${SERVER_PORT:-3000}"
SITES_AVAILABLE="/etc/nginx/sites-available/douxing-api"
SITES_ENABLED="/etc/nginx/sites-enabled/douxing-api"
CONF_SRC="$ROOT/deploy/nginx/douxing-api.conf"
LE_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
LE_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

echo "[nginx:auto] 域名: ${DOMAIN} → 127.0.0.1:${SERVER_PORT}"

if ! command -v nginx >/dev/null 2>&1; then
  echo "[nginx:auto] 未安装 Nginx，跳过（apt install -y nginx）"
  exit 0
fi

if curl -sf "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
  echo "[nginx:auto] ✓ https://${DOMAIN}/api/health 已正常，无需重复配置"
  exit 0
fi

if [[ -f "$SITES_AVAILABLE" ]] && grep -q 'ssl_certificate' "$SITES_AVAILABLE"; then
  echo "[nginx:auto] 检测到已有 SSL 配置，仅 reload（不覆盖 Certbot 文件）"
  nginx -t
  systemctl reload nginx
  exit 0
fi

mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

# 生成项目内配置文件
if [[ -f "$LE_CERT" && -f "$LE_KEY" ]]; then
  echo "[nginx:auto] 使用 Let's Encrypt 证书"
  sed -e "s/__DOMAIN__/${DOMAIN}/g" \
      -e "s/__SERVER_PORT__/${SERVER_PORT}/g" \
      -e "s#__SSL_CERT__#${LE_CERT}#g" \
      -e "s#__SSL_KEY__#${LE_KEY}#g" \
      "$ROOT/deploy/nginx/douxing-api.ssl.conf.template" > "$CONF_SRC"
elif [[ ! -f "$CONF_SRC" ]]; then
  echo "[nginx:auto] 生成 HTTP 反代配置（待 Certbot）"
  sed -e "s/__DOMAIN__/${DOMAIN}/g" \
      -e "s/__SERVER_PORT__/${SERVER_PORT}/g" \
      "$ROOT/deploy/nginx/douxing-api.conf.template" > "$CONF_SRC"
fi

if [[ ! -f "$CONF_SRC" ]]; then
  echo "[nginx:auto] 错误: 未找到 $CONF_SRC"
  exit 1
fi

cp "$CONF_SRC" "$SITES_AVAILABLE"
ln -sf "$SITES_AVAILABLE" "$SITES_ENABLED"
rm -f /etc/nginx/sites-enabled/default

if [[ -d /etc/nginx/conf.d ]]; then
  cp "$SITES_AVAILABLE" /etc/nginx/conf.d/douxing-api.conf
fi

nginx -t
systemctl enable nginx 2>/dev/null || true
systemctl reload nginx
echo "[nginx:auto] ✓ Nginx 配置已安装"

if curl -sf "https://${DOMAIN}/api/health" >/dev/null 2>&1; then
  echo "[nginx:auto] ✓ HTTPS 已就绪"
  exit 0
fi

if [[ -f "$LE_CERT" ]]; then
  echo "[nginx:auto] 证书存在但 HTTPS 未通，请检查 DNS/防火墙 443"
  exit 0
fi

if command -v certbot >/dev/null 2>&1 && [[ -n "$CERTBOT_EMAIL" ]]; then
  echo "[nginx:auto] 首次 HTTPS，运行 Certbot..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --email "$CERTBOT_EMAIL"
  curl -sf "https://${DOMAIN}/api/health" && echo "" && echo "[nginx:auto] ✓ Certbot 完成"
elif command -v certbot >/dev/null 2>&1; then
  echo "[nginx:auto] 首次 HTTPS 请执行（或在 .env 设置 NGINX_CERTBOT_EMAIL）："
  echo "  sudo certbot --nginx -d ${DOMAIN}"
else
  echo "[nginx:auto] HTTP 反代已就绪: curl http://${DOMAIN}/api/health"
fi
