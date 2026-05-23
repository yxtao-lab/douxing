#!/usr/bin/env bash
# 兜行 · Nginx + Certbot 一键 HTTPS（Let's Encrypt）
#
# 用法（项目根目录 /opt/douxing）:
#   sudo bash scripts/install-nginx-certbot.sh
#   sudo bash scripts/install-nginx-certbot.sh api.yxtao.site
#   sudo bash scripts/install-nginx-certbot.sh api.yxtao.site you@example.com
#
# 流程: 写入仅 HTTP 的 Nginx 配置 → certbot --nginx 自动签证书并开启 HTTPS
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行: sudo bash scripts/install-nginx-certbot.sh"
  exit 1
fi

DOMAIN="${1:-api.yxtao.site}"
CERTBOT_EMAIL="${2:-}"
SERVER_PORT="${3:-3000}"
SITES_AVAILABLE="/etc/nginx/sites-available/douxing-api"
SITES_ENABLED="/etc/nginx/sites-enabled/douxing-api"

echo "========================================"
echo "  兜行 · Certbot HTTPS 安装"
echo "  域名: ${DOMAIN}"
echo "  后端: 127.0.0.1:${SERVER_PORT}"
echo "========================================"

for cmd in nginx certbot curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "错误: 未安装 ${cmd}"
    echo "  apt install -y nginx certbot python3-certbot-nginx curl"
    exit 1
  fi
done

echo "[1/5] 检查本机 API..."
if curl -sf "http://127.0.0.1:${SERVER_PORT}/api/health" >/dev/null; then
  echo "  ✓ http://127.0.0.1:${SERVER_PORT}/api/health 正常"
else
  echo "  ⚠ 本机 API 未响应，请先: pnpm deploy:server --skip-docker --skip-build"
fi

echo "[2/5] 写入 Nginx 配置（仅 HTTP，供 Certbot 验证）..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > "$SITES_AVAILABLE" <<EOF
# 兜行 API — ${DOMAIN}（Certbot 会自动追加 HTTPS）
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    client_max_body_size 10m;

    location /uploads/ {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${SERVER_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }
}
EOF

ln -sf "$SITES_AVAILABLE" "$SITES_ENABLED"
rm -f /etc/nginx/sites-enabled/default

if [[ -d /etc/nginx/conf.d ]]; then
  cp "$SITES_AVAILABLE" /etc/nginx/conf.d/douxing-api.conf
  rm -f /etc/nginx/conf.d/default.conf.bak 2>/dev/null || true
  for stale in /etc/nginx/conf.d/default.conf; do
    [[ -f "$stale" && ! -f "${stale}.bak" ]] && mv "$stale" "${stale}.bak"
  done
fi

nginx -t
systemctl enable nginx 2>/dev/null || true
systemctl reload nginx
echo "  ✓ Nginx HTTP 配置已生效"

echo "[3/5] 验证 HTTP 反代..."
if curl -sf "http://${DOMAIN}/api/health" >/dev/null; then
  echo "  ✓ http://${DOMAIN}/api/health 正常"
else
  echo "  ⚠ http://${DOMAIN} 未通，请检查 DNS 与防火墙 80 端口"
  echo "    dig +short ${DOMAIN}"
fi

echo "[4/5] 运行 Certbot 申请证书..."
CERTBOT_ARGS=(--nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect)
if [[ -n "$CERTBOT_EMAIL" ]]; then
  CERTBOT_ARGS+=(--email "$CERTBOT_EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi

if certbot "${CERTBOT_ARGS[@]}"; then
  echo "  ✓ Certbot 完成"
else
  echo ""
  echo "Certbot 失败。可手动交互执行:"
  echo "  certbot --nginx -d ${DOMAIN}"
  exit 1
fi

echo "[5/5] 验证 HTTPS..."
sleep 1
if curl -sf "https://${DOMAIN}/api/health"; then
  echo ""
  echo "========================================"
  echo "  安装成功"
  echo "  https://${DOMAIN}/api/health"
  echo "  证书续期: certbot renew --dry-run"
  echo "========================================"
else
  echo "HTTPS 验证失败，查看: tail -f /var/log/nginx/error.log"
  exit 1
fi
