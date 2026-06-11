#!/usr/bin/env bash
# 兜行 · 安装 Gitee Webhook 发版服务（systemd + Nginx 反代片段）
#
# 用法（在项目根目录，Debian/Ubuntu）:
#   sudo bash scripts/install-webhook-service.sh
#   sudo bash scripts/install-webhook-service.sh --nginx-domain api.yxtao.site
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_DOMAIN=""
WEBHOOK_PORT="${WEBHOOK_PORT:-9090}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nginx-domain)
      NGINX_DOMAIN="$2"
      shift 2
      ;;
    --node)
      NODE_BIN="$2"
      shift 2
      ;;
    *)
      echo "未知参数: $1"
      exit 1
      ;;
  esac
done

detectNodeBin() {
  if [[ -n "${NODE_BIN:-}" && -x "$NODE_BIN" ]]; then
    echo "$NODE_BIN"
    return 0
  fi
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi
  local candidate
  for candidate in \
    /usr/local/bin/node \
    /usr/bin/node \
    /root/.nvm/versions/node/*/bin/node \
    /home/*/.nvm/versions/node/*/bin/node \
    /root/.fnm/node-versions/*/installation/bin/node; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

if [[ ! -f "$ROOT/.env" ]]; then
  echo "[install-webhook] 请先在 $ROOT 配置 .env（含 WEBHOOK_SECRET）"
  exit 1
fi

if ! grep -q '^WEBHOOK_SECRET=.' "$ROOT/.env" 2>/dev/null; then
  echo "[install-webhook] 请在 .env 中设置 WEBHOOK_SECRET=随机长字符串"
  exit 1
fi

if [[ ! -f "$ROOT/scripts/gitee-webhook-server.mjs" ]]; then
  echo "[install-webhook] 缺少 scripts/gitee-webhook-server.mjs，请先 git pull"
  exit 1
fi

if ! NODE_BIN="$(detectNodeBin)"; then
  echo "[install-webhook] 未找到 node，请先安装 Node.js 18+，或指定:"
  echo "  sudo bash scripts/install-webhook-service.sh --node /path/to/node"
  exit 1
fi

NODE_DIR="$(dirname "$NODE_BIN")"
SERVICE_PATH="${NODE_DIR}:/usr/local/bin:/usr/bin:/bin"

echo "[install-webhook] Node: $NODE_BIN"
echo "[install-webhook] 项目: $ROOT"

SERVICE_SRC="$ROOT/deploy/systemd/douxing-webhook.service"
SERVICE_DST="/etc/systemd/system/douxing-webhook.service"

sed \
  -e "s|__ROOT__|$ROOT|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__SERVICE_PATH__|$SERVICE_PATH|g" \
  "$SERVICE_SRC" | sudo tee "$SERVICE_DST" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable douxing-webhook
sudo systemctl restart douxing-webhook
sudo systemctl --no-pager status douxing-webhook || true

echo ""
echo "[install-webhook] ✓ systemd 服务已启用 (douxing-webhook)"

if [[ -n "$NGINX_DOMAIN" ]]; then
  SNIPPET="/etc/nginx/snippets/douxing-webhook.conf"
  sudo tee "$SNIPPET" >/dev/null <<EOF
# 兜行 Gitee Webhook（由 install-webhook-service.sh 生成）
location /hooks/douxing-deploy {
    proxy_pass http://127.0.0.1:${WEBHOOK_PORT}/hooks/douxing-deploy;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Gitee-Token \$http_x_gitee_token;
    proxy_set_header X-Gitee-Event \$http_x_gitee_event;
    client_max_body_size 2m;
}
EOF
  echo "[install-webhook] ✓ Nginx 片段: $SNIPPET"
  echo "[install-webhook] 请在 api 站点 server { } 内 include snippets/douxing-webhook.conf;"
  echo "[install-webhook] 然后: sudo nginx -t && sudo systemctl reload nginx"
fi

echo ""
echo "Gitee Webhook URL:"
echo "  https://${NGINX_DOMAIN:-api.你的域名}/hooks/douxing-deploy"
echo "密码与 .env 中 WEBHOOK_SECRET 一致"
echo "发版日志: $ROOT/logs/webhook-deploy.log"
