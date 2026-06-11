#!/usr/bin/env bash
# 兜行 · Gitee Go 远程 SSH 发版（在流水线 Shell 步骤中调用）
#
# 必需环境变量（在 Gitee Go「流水线变量 / 机密」中配置）：
#   DEPLOY_HOST      服务器 IP 或域名
#   DEPLOY_USER      SSH 用户名
#   DEPLOY_SSH_KEY   SSH 私钥全文（OpenSSH 格式）
#
# 可选：
#   DEPLOY_PATH      项目目录，默认 /opt/douxing
#   DEPLOY_TARGET    server,pc,web 或组合，默认 server,pc
#   DEPLOY_STAGING   设为 true 时使用 staging 构建
#   DEPLOY_SKIP_DOCKER  设为 true 时跳过后端 Docker
#   DEPLOY_HEALTH_URL   发版后健康检查 URL
set -euo pipefail

: "${DEPLOY_HOST:?缺少 DEPLOY_HOST}"
: "${DEPLOY_USER:?缺少 DEPLOY_USER}"
: "${DEPLOY_SSH_KEY:?缺少 DEPLOY_SSH_KEY}"

DEPLOY_PATH="${DEPLOY_PATH:-/opt/douxing}"
DEPLOY_TARGET="${DEPLOY_TARGET:-server,pc}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL:-https://api.yxtao.site/api/health}"

KEY_FILE="$(mktemp)"
trap 'rm -f "$KEY_FILE"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$KEY_FILE"
chmod 600 "$KEY_FILE"

SSH_OPTS=(-i "$KEY_FILE" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

RELEASE_ARGS="--target=${DEPLOY_TARGET}"
if [[ "${DEPLOY_STAGING:-false}" == "true" ]]; then
  RELEASE_ARGS="$RELEASE_ARGS --staging"
fi
if [[ "${DEPLOY_SKIP_DOCKER:-true}" == "true" ]]; then
  RELEASE_ARGS="$RELEASE_ARGS --skip-docker"
fi

echo "[gitee-deploy] 连接 ${DEPLOY_USER}@${DEPLOY_HOST} ..."

ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<EOF
set -euo pipefail
cd "${DEPLOY_PATH}"
git fetch origin
git checkout main 2>/dev/null || git checkout master
git pull origin \$(git branch --show-current)
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
fi
pnpm install --frozen-lockfile --prod=false
pnpm deploy:release -- ${RELEASE_ARGS}
EOF

echo "[gitee-deploy] 健康检查: ${DEPLOY_HEALTH_URL}"
for i in $(seq 1 12); do
  if curl -sf "${DEPLOY_HEALTH_URL}" >/dev/null; then
    echo "[gitee-deploy] ✓ API 健康检查通过"
    exit 0
  fi
  echo "[gitee-deploy] 等待 API ... (${i}/12)"
  sleep 10
done

echo "[gitee-deploy] 警告: API 健康检查未通过，请登录服务器排查"
exit 1
