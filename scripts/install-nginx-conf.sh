#!/usr/bin/env bash
# 安装兜行 API 的 Nginx 反代配置（自动适配 OpenCloudOS / RHEL / Debian）
# 用法: sudo bash scripts/install-nginx-conf.sh [api.yxtao.site]
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONF_SRC="$ROOT/deploy/nginx/douxing-api.conf"
DOMAIN="${1:-}"

if [[ ! -f "$CONF_SRC" ]]; then
  echo "未找到 $CONF_SRC"
  echo "请先在项目根目录执行:"
  echo "  pnpm deploy:server --nginx api.yxtao.site --skip-docker --skip-build"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "未安装 Nginx，请执行: dnf install -y nginx && systemctl enable --now nginx"
  exit 1
fi

pick_target_dir() {
  if [[ -d /etc/nginx/conf.d ]]; then
    echo /etc/nginx/conf.d
    return
  fi
  if [[ -d /etc/nginx/default.d ]]; then
    echo /etc/nginx/default.d
    return
  fi
  mkdir -p /etc/nginx/conf.d
  if [[ -f /etc/nginx/nginx.conf ]] && ! grep -q 'conf\.d/\*\.conf' /etc/nginx/nginx.conf; then
    echo "警告: /etc/nginx/nginx.conf 未 include conf.d，请手动在 http {} 内添加:"
    echo "  include /etc/nginx/conf.d/*.conf;"
  fi
  echo /etc/nginx/conf.d
}

TARGET_DIR="$(pick_target_dir)"
TARGET_FILE="$TARGET_DIR/douxing-api.conf"

cp "$CONF_SRC" "$TARGET_FILE"
echo "已复制配置 → $TARGET_FILE"

# 禁用常见默认静态站（避免 api 域名仍走 default 404）
for stale in \
  /etc/nginx/conf.d/default.conf \
  /etc/nginx/default.d/default.conf; do
  if [[ -f "$stale" ]] && [[ ! -f "${stale}.bak" ]]; then
    mv "$stale" "${stale}.bak"
    echo "已备份默认站点: ${stale}.bak"
  fi
done

if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" != "Disabled" ]]; then
  setsebool -P httpd_can_network_connect 1 2>/dev/null || true
  echo "已设置 SELinux httpd_can_network_connect"
fi

nginx -t
systemctl enable nginx 2>/dev/null || true
systemctl reload nginx

echo ""
echo "Nginx 配置已重载。"
echo "下一步:"
if [[ -n "$DOMAIN" ]]; then
  echo "  certbot --nginx -d $DOMAIN"
fi
echo "  curl http://127.0.0.1:3000/api/health    # 先确保 Node 已启动"
echo "  curl -k https://api.yxtao.site/api/health"
