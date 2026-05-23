#!/usr/bin/env bash
# 为轻量服务器添加 2GB swap（缓解 tsc / Node 内存不足）
# 用法: sudo bash scripts/add-swap.sh [大小G，默认 2]
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请使用 sudo 执行"
  exit 1
fi

SIZE_G="${1:-2}"
SWAP_FILE="/swapfile"

if swapon --show | grep -q "$SWAP_FILE"; then
  echo "swap 已启用: $SWAP_FILE"
  free -h
  exit 0
fi

echo "创建 ${SIZE_G}G swap: $SWAP_FILE"
fallocate -l "${SIZE_G}G" "$SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$((SIZE_G * 1024)) status=progress
chmod 600 "$SWAP_FILE"
mkswap "$SWAP_FILE"
swapon "$SWAP_FILE"

if ! grep -q "$SWAP_FILE" /etc/fstab; then
  echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
fi

echo "swap 已启用:"
free -h
