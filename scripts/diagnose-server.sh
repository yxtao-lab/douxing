#!/usr/bin/env bash
# 兜行 · 生产服务器快速诊断
# 用法: bash scripts/diagnose-server.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "========== 兜行服务器诊断 =========="
echo "项目目录: $ROOT"
echo ""

echo "[1] Node / pnpm"
command -v node >/dev/null && node -v || echo "  ✗ node 未安装"
command -v pnpm >/dev/null && pnpm -v || echo "  ✗ pnpm 未安装"
echo ""

echo "[2] .env"
if [[ -f .env ]]; then
  grep -E '^(SERVER_PORT|API_PUBLIC_BASE_URL|DATABASE_URL)=' .env | sed 's/\(PASSWORD=\).*/\1***/' || true
else
  echo "  ✗ 缺少 .env"
fi
echo ""

PORT="$(grep -E '^SERVER_PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '\r' || true)"
PORT="${PORT:-3000}"

echo "[3] PM2"
if command -v pm2 >/dev/null; then
  pm2 status 2>/dev/null || pnpm exec pm2 status 2>/dev/null || echo "  pm2 无进程"
else
  echo "  ✗ pm2 未安装（pnpm install 后可用 pnpm exec pm2）"
fi
echo ""

echo "[4] 本机 API :$PORT"
if curl -sf "http://127.0.0.1:${PORT}/api/health" >/tmp/dx-health.json 2>/dev/null; then
  echo "  ✓ http://127.0.0.1:${PORT}/api/health"
  head -c 200 /tmp/dx-health.json; echo
else
  echo "  ✗ 无法连接 http://127.0.0.1:${PORT}/api/health"
  echo "  常见原因: PM2 未启动 / 构建产物缺失 / 数据库连不上"
  if [[ -f logs/pm2-api-error.log ]]; then
    echo "  --- pm2 错误日志 (末 15 行) ---"
    tail -n 15 logs/pm2-api-error.log 2>/dev/null || true
  fi
  if command -v pm2 >/dev/null; then
    pm2 logs douxing-api --lines 15 --nostream 2>/dev/null || true
  fi
fi
echo ""

echo "[5] 构建产物"
[[ -f packages/server/dist/index.js ]] && echo "  ✓ packages/server/dist/index.js" || echo "  ✗ 需 pnpm build:server"
echo ""

echo "[6] Docker MySQL/Redis"
if command -v docker >/dev/null; then
  docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep -E 'douxing|NAMES' || echo "  无 douxing 容器"
else
  echo "  ○ docker 未安装"
fi
echo ""

echo "[7] Nginx"
if command -v nginx >/dev/null; then
  nginx -v 2>&1
  for d in /etc/nginx/conf.d /etc/nginx/default.d; do
    [[ -d "$d" ]] && echo "  目录: $d" && ls -la "$d"/*.conf 2>/dev/null | head -5 || true
  done
  grep -r "proxy_pass" /etc/nginx/conf.d /etc/nginx/default.d 2>/dev/null | head -5 || echo "  未找到 proxy_pass 配置"
else
  echo "  ✗ nginx 未安装"
fi
echo ""

echo "========== 建议命令 =========="
echo "  pnpm build:server && pnpm deploy:server --skip-docker"
echo "  pnpm exec pm2 logs douxing-api"
echo "  sudo bash scripts/install-nginx-conf.sh api.yxtao.site"
