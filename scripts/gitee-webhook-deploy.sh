#!/usr/bin/env bash
# 兜行 · 服务器 Webhook 发版（Gitee Push 触发或手动执行）
#
# 手动: bash scripts/gitee-webhook-deploy.sh
# 自动: Gitee Webhook → gitee-webhook-server.mjs → 本脚本
#
# .env 可选:
#   DEPLOY_PATH=/opt/douxing
#   DEPLOY_TARGET=server,pc
#   WEBHOOK_DEPLOY_BRANCHES=main,master
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
LOCK_FILE="${WEBHOOK_DEPLOY_LOCK:-/tmp/douxing-deploy.lock}"
LOG_DIR="${WEBHOOK_DEPLOY_LOG_DIR:-$DEPLOY_PATH/logs}"
mkdir -p "$LOG_DIR"
LOG_FILE="${WEBHOOK_DEPLOY_LOG:-$LOG_DIR/webhook-deploy.log}"

exec >>"$LOG_FILE" 2>&1
echo ""
echo "========== [webhook-deploy] $(date -Iseconds) =========="

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[webhook-deploy] 已有发版任务进行中，跳过"
  exit 0
fi

echo "[webhook-deploy] 目录: $DEPLOY_PATH"
cd "$DEPLOY_PATH"

BRANCH="${WEBHOOK_BRANCH:-$(git branch --show-current 2>/dev/null || echo main)}"
echo "[webhook-deploy] 分支: $BRANCH"

git fetch origin
git pull origin "$BRANCH"

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi

pnpm install --frozen-lockfile
pnpm deploy:release -- --target="$DEPLOY_TARGET" --skip-docker

echo "[webhook-deploy] ✓ 发版完成"
