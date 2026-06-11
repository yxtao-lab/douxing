#!/usr/bin/env bash
# 兜行 · 服务器 Webhook 发版（Gitee Push 触发，按 package 增量发版）
#
# 流程: git pull → 检测变更 package → 仅构建/发布对应 target
# 日志: tail -f /opt/douxing/logs/webhook-deploy.log
#
# .env 可选:
#   WEBHOOK_DEPLOY_MODE=auto          auto=按变更发版 | full=每次全量
#   WEBHOOK_DEPLOY_ALLOW=server,pc,web
#   DEPLOY_PATH=/opt/douxing
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
LOCK_FILE="${WEBHOOK_DEPLOY_LOCK:-/tmp/douxing-deploy.lock}"
LOG_DIR="${WEBHOOK_DEPLOY_LOG_DIR:-$DEPLOY_PATH/logs}"
mkdir -p "$LOG_DIR"
LOG_FILE="${WEBHOOK_DEPLOY_LOG:-$LOG_DIR/webhook-deploy.log}"

setupLogging() {
  if [[ -t 1 || "${WEBHOOK_VERBOSE:-}" == "1" ]]; then
    echo "[webhook-deploy] 日志: $LOG_FILE"
    exec > >(tee -a "$LOG_FILE") 2>&1
  else
    exec >>"$LOG_FILE" 2>&1
  fi
}

setupLogging

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
echo "[webhook-deploy] before=${WEBHOOK_BEFORE:-?} after=${WEBHOOK_AFTER:-?}"

echo "[webhook-deploy] git fetch / pull ..."
git fetch origin
git pull origin "$BRANCH"

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi

echo "[webhook-deploy] pnpm install（含 dev）..."
pnpm install --frozen-lockfile --prod=false

DEPLOY_MODE="${WEBHOOK_DEPLOY_MODE:-auto}"
if [[ "$DEPLOY_MODE" == "full" ]]; then
  DEPLOY_TARGET="${DEPLOY_TARGET:-server,pc,web}"
  echo "[webhook-deploy] 模式: full → $DEPLOY_TARGET"
else
  DEPLOY_TARGET="$(node scripts/detect-deploy-targets.mjs || true)"
  if [[ -z "$DEPLOY_TARGET" ]]; then
    echo "[webhook-deploy] 无需要发版的 package 变更，跳过"
    exit 0
  fi
  echo "[webhook-deploy] 模式: auto → 检测到 target: $DEPLOY_TARGET"
fi

echo "[webhook-deploy] 开始发版（2G 机前端构建可能 5～15 分钟）..."
pnpm deploy:release -- --target="$DEPLOY_TARGET" --skip-docker

echo "[webhook-deploy] ✓ 发版完成: $DEPLOY_TARGET"
