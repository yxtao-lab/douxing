#!/usr/bin/env bash
# 兜行 · Nginx HTTPS 反代一键安装（已有 SSL 证书，Debian 12 / Ubuntu 兼容）
#
# 用法（在项目根目录 /opt/douxing 执行）:
#   sudo bash scripts/install-nginx-ssl.sh
#   sudo bash scripts/install-nginx-ssl.sh api.yxtao.site
#   sudo bash scripts/install-nginx-ssl.sh api.yxtao.site /path/to/fullchain.crt /path/to/privkey.key
#   sudo bash scripts/install-nginx-ssl.sh api.yxtao.site /path/to/cert.crt /path/to/key.key 3000
#
# 证书默认目录: /etc/nginx/ssl/<域名>/
#   自动识别: *_bundle.crt / fullchain.pem / *.crt
#             *.key / privkey.pem
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行: sudo bash scripts/install-nginx-ssl.sh"
  exit 1
fi

DOMAIN="${1:-api.yxtao.site}"
SSL_CERT="${2:-}"
SSL_KEY="${3:-}"
SERVER_PORT="${4:-3000}"
SSL_DIR="/etc/nginx/ssl/${DOMAIN}"
SITES_AVAILABLE="/etc/nginx/sites-available/douxing-api"
SITES_ENABLED="/etc/nginx/sites-enabled/douxing-api"

echo "========================================"
echo "  兜行 · Nginx HTTPS 安装"
echo "  域名: ${DOMAIN}"
echo "  后端: 127.0.0.1:${SERVER_PORT}"
echo "========================================"

if ! command -v nginx >/dev/null 2>&1; then
  echo "错误: 未安装 Nginx"
  echo "  Debian/Ubuntu: apt install -y nginx"
  exit 1
fi

find_first_file() {
  local dir="$1"
  shift
  for pattern in "$@"; do
    # shellcheck disable=SC2086
    local match
    match="$(ls -1 ${dir}/${pattern} 2>/dev/null | head -n 1 || true)"
    if [[ -n "$match" && -f "$match" ]]; then
      echo "$match"
      return 0
    fi
  done
  return 1
}

if [[ -z "$SSL_CERT" ]]; then
  mkdir -p "$SSL_DIR"
  SSL_CERT="$(find_first_file "$SSL_DIR" '*_bundle.crt' 'fullchain.pem' '*.crt' || true)"
fi

if [[ -z "$SSL_KEY" ]]; then
  SSL_KEY="$(find_first_file "$SSL_DIR" '*.key' 'privkey.pem' || true)"
fi

if [[ -z "$SSL_CERT" || ! -f "$SSL_CERT" ]]; then
  echo ""
  echo "错误: 未找到证书文件"
  echo "  请将证书放到: ${SSL_DIR}/"
  echo "  或显式指定:"
  echo "    sudo bash scripts/install-nginx-ssl.sh ${DOMAIN} /path/to/fullchain.crt /path/to/privkey.key"
  echo ""
  echo "  腾讯云 Nginx 格式常见文件名:"
  echo "    ${DOMAIN}_bundle.crt"
  echo "    ${DOMAIN}.key"
  exit 1
fi

if [[ -z "$SSL_KEY" || ! -f "$SSL_KEY" ]]; then
  echo "错误: 未找到私钥文件，请放到 ${SSL_DIR}/ 或通过第 3 个参数指定"
  exit 1
fi

chmod 644 "$SSL_CERT"
chmod 600 "$SSL_KEY"

echo "  证书: ${SSL_CERT}"
echo "  私钥: ${SSL_KEY}"

if command -v openssl >/dev/null 2>&1; then
  echo ""
  echo "  证书域名 (SAN):"
  openssl x509 -in "$SSL_CERT" -noout -subject -ext subjectAltName 2>/dev/null | sed 's/^/    /'
  if ! openssl x509 -in "$SSL_CERT" -noout -text 2>/dev/null | grep -qE "DNS:${DOMAIN//./\\.}(,|$)|DNS:\*\.${DOMAIN#*.}"; then
    echo ""
    echo "  ⚠ 警告: 该证书可能不匹配 ${DOMAIN}"
    echo "    请确认申请/下载的是 api 子域名证书，或使用通配符 *.yxtao.site"
    echo "    继续安装将导致 curl SSL 报错: no alternative certificate subject name matches"
    read -r -p "  仍要继续? [y/N] " confirm
    if [[ "${confirm,,}" != "y" ]]; then
      exit 1
    fi
  else
    echo "  ✓ 证书域名匹配 ${DOMAIN}"
  fi
fi
echo ""

echo "[1/4] 检查本机 API..."
if curl -sf "http://127.0.0.1:${SERVER_PORT}/api/health" >/dev/null; then
  echo "  ✓ http://127.0.0.1:${SERVER_PORT}/api/health 正常"
else
  echo "  ⚠ 本机 API 未响应，请先启动 PM2:"
  echo "    cd /opt/douxing && pnpm deploy:server --skip-docker --skip-build"
  echo "  继续安装 Nginx 配置..."
fi

echo "[2/4] 写入 Nginx 配置..."
mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

cat > "$SITES_AVAILABLE" <<EOF
# 兜行 API — ${DOMAIN}（由 scripts/install-nginx-ssl.sh 生成）
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

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

# OpenCloudOS / RHEL 备用路径
if [[ -d /etc/nginx/conf.d ]]; then
  cp "$SITES_AVAILABLE" /etc/nginx/conf.d/douxing-api.conf
  for stale in /etc/nginx/conf.d/default.conf /etc/nginx/default.d/default.conf; do
    if [[ -f "$stale" && ! -f "${stale}.bak" ]]; then
      mv "$stale" "${stale}.bak"
      echo "  已备份默认站点: ${stale}.bak"
    fi
  done
fi

if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" != "Disabled" ]]; then
  setsebool -P httpd_can_network_connect 1 2>/dev/null || true
fi

echo "[3/4] 测试并重载 Nginx..."
nginx -t
systemctl enable nginx 2>/dev/null || true
systemctl reload nginx
echo "  ✓ Nginx 已重载"

echo "[4/4] 验证 HTTPS..."
sleep 1
if curl -sf "https://${DOMAIN}/api/health"; then
  echo ""
  echo "========================================"
  echo "  安装成功"
  echo "  https://${DOMAIN}/api/health"
  echo "========================================"
else
  echo ""
  echo "========================================"
  echo "  Nginx 已配置，但 HTTPS 验证未通过"
  echo "  请检查:"
  echo "    1. 腾讯云防火墙是否放行 80、443"
  echo "    2. DNS: dig +short ${DOMAIN}"
  echo "    3. 日志: tail -f /var/log/nginx/error.log"
  echo "========================================"
  exit 1
fi
