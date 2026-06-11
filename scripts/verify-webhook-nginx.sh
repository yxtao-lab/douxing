#!/usr/bin/env bash
# 兜行 · 检查 Webhook Nginx 反代是否生效
# 用法: bash scripts/verify-webhook-nginx.sh api.yxtao.site
set -euo pipefail

DOMAIN="${1:-api.yxtao.site}"
HOOK_PATH="/hooks/douxing-deploy"
WEBHOOK_PORT="${WEBHOOK_PORT:-9090}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/.env"
fi
TOKEN="${WEBHOOK_SECRET:-test-token}"

echo "=== 1. Webhook 进程 (127.0.0.1:${WEBHOOK_PORT}) ==="
if curl -sf "http://127.0.0.1:${WEBHOOK_PORT}/health" >/dev/null; then
  curl -s "http://127.0.0.1:${WEBHOOK_PORT}/health"
  echo ""
else
  echo "✗ 无法访问，请检查: systemctl status douxing-webhook"
  exit 1
fi

echo ""
echo "=== 2. Nginx 是否包含 webhook 片段 ==="
if grep -rq "douxing-webhook" /etc/nginx/ 2>/dev/null; then
  grep -rn "douxing-webhook\|hooks/douxing-deploy" /etc/nginx/sites-enabled/ /etc/nginx/snippets/ 2>/dev/null || true
else
  echo "✗ 未找到 include snippets/douxing-webhook.conf"
  echo "  请在 api 站点 server { }（含 listen 443）内添加:"
  echo "  include snippets/douxing-webhook.conf;"
fi

echo ""
echo "=== 3. 重复 server_name 检查 ==="
grep -rn "server_name.*${DOMAIN}" /etc/nginx/sites-enabled/ 2>/dev/null || true

echo ""
echo "=== 4. 经 Nginx 访问 (HTTP Host: ${DOMAIN}) ==="
HTTP_CODE=$(curl -s -o /tmp/douxing-hook-test.json -w "%{http_code}" \
  -X POST "http://127.0.0.1${HOOK_PATH}" \
  -H "Host: ${DOMAIN}" \
  -H "Content-Type: application/json" \
  -H "X-Gitee-Event: push_hooks" \
  -H "X-Gitee-Token: ${TOKEN}" \
  -d '{"ref":"refs/heads/main","commits":[]}' || echo "000")
echo "HTTP ${HTTP_CODE}"
cat /tmp/douxing-hook-test.json 2>/dev/null || true
echo ""

if [[ "$HTTP_CODE" == "404" ]]; then
  echo "✗ 404：请求未到达 webhook 服务，多半 Nginx 未 include 或 443 块未配置"
elif [[ "$HTTP_CODE" == "401" ]]; then
  echo "✗ 401：Token 与 .env WEBHOOK_SECRET 不一致"
elif [[ "$HTTP_CODE" == "202" || "$HTTP_CODE" == "200" ]]; then
  echo "✓ Nginx 反代正常"
fi

echo ""
echo "=== 5. 经 HTTPS 外网（若 DNS 已解析） ==="
curl -s -o /tmp/douxing-hook-https.json -w "HTTPS HTTP %{http_code}\n" \
  -X POST "https://${DOMAIN}${HOOK_PATH}" \
  -H "Content-Type: application/json" \
  -H "X-Gitee-Event: push_hooks" \
  -H "X-Gitee-Token: ${TOKEN}" \
  -d '{"ref":"refs/heads/main","commits":[]}' || true
cat /tmp/douxing-hook-https.json 2>/dev/null || true
echo ""
