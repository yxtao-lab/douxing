#!/usr/bin/env bash
# 兜行 · 服务器 Webhook 发版（无 Gitee Go 时的轻量方案）
#
# 在 Gitee 仓库 → 管理 → WebHooks 添加：
#   URL: https://你的域名/hooks/douxing-deploy  （或内网 curl 触发）
#   密码: 与下方 WEBHOOK_SECRET 一致
#
# 更简单的做法：cron 或手动在服务器执行：
#   bash scripts/gitee-webhook-deploy.sh
#
# 环境变量（写入服务器 .env 或 /etc/douxing/deploy.env）：
#   DEPLOY_PATH=/opt/douxing
#   DEPLOY_TARGET=server,pc
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DEPLOY_PATH="${DEPLOY_PATH:-$ROOT}"
DEPLOY_TARGET="${DEPLOY_TARGET:-server,pc}"

echo "[webhook-deploy] 目录: $DEPLOY_PATH"
cd "$DEPLOY_PATH"

BRANCH="$(git branch --show-current 2>/dev/null || echo main)"
git fetch origin
git pull origin "$BRANCH"

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi

pnpm install --frozen-lockfile
pnpm deploy:release -- --target="$DEPLOY_TARGET" --skip-docker

echo "[webhook-deploy] ✓ 发版完成"
