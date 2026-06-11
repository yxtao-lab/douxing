#!/usr/bin/env bash
# 兜行 · CI 构建脚本（Gitee Go / 本地自检）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[ci-build] 项目根目录: $ROOT"

if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm@9.15.0 --activate
else
  npm install -g pnpm@9.15.0
fi

pnpm config set registry https://registry.npmmirror.com 2>/dev/null || true
pnpm install --frozen-lockfile

echo "[ci-build] 构建 @douxing/shared ..."
pnpm --filter @douxing/shared build

echo "[ci-build] PC 类型检查 ..."
pnpm --filter @douxing/pc lint

echo "[ci-build] 构建后端 ..."
pnpm build:server

echo "[ci-build] 构建 PC 用户端 ..."
pnpm build:pc

echo "[ci-build] 构建 Web 管理端 ..."
pnpm build:web

echo "[ci-build] ✓ 全部构建通过"
