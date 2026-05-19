#!/usr/bin/env bash
# 兜行一键部署 (Linux / macOS)
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/deploy.mjs "$@"
