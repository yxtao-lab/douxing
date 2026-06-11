#!/usr/bin/env bash
# 兜行 · PC + Web 管理端一键部署（构建 + Nginx）
#
# 用法:
#   sudo bash scripts/deploy-static-sites.sh --certbot
set -euo pipefail

USE_CERTBOT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --certbot)
      USE_CERTBOT=true
      shift
      ;;
    *)
      echo "[deploy:static-sites] 未知参数: $1"
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXTRA=()
if [[ "$USE_CERTBOT" == true ]]; then
  EXTRA+=(--certbot)
fi

bash scripts/deploy-pc-site.sh "${EXTRA[@]}"
bash scripts/deploy-web-site.sh "${EXTRA[@]}"

echo "[deploy:static-sites] ✓ PC + Web 管理端部署完成"
