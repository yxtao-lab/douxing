#!/usr/bin/env bash
# 兜行 · Debian 12 服务器环境初始化
# 用法: sudo bash scripts/setup-debian12.sh
# 适用：腾讯云轻量应用服务器重装 Debian 12 后首次配置
set -euo pipefail

if [[ "${EUID:-0}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行: sudo bash scripts/setup-debian12.sh"
  exit 1
fi

echo "========================================"
echo "  兜行 · Debian 12 环境初始化"
echo "========================================"

if [[ -f /etc/os-release ]]; then
  # shellcheck disable=SC1091
  source /etc/os-release
  echo "系统: ${PRETTY_NAME:-unknown}"
fi

echo "[1/8] 更新系统..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "[2/8] 安装基础工具..."
apt-get install -y git curl wget vim ca-certificates gnupg lsb-release ufw sudo

echo "[3/8] 安装 Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "  Node: $(node -v)"

if id -u "${SUDO_USER:-root}" >/dev/null 2>&1; then
  DEPLOY_USER="${SUDO_USER}"
else
  DEPLOY_USER="$(logname 2>/dev/null || echo root)"
fi

echo "[4/8] 启用 pnpm..."
sudo -u "$DEPLOY_USER" bash -lc 'corepack enable && corepack prepare pnpm@9.15.0 --activate'
echo "  pnpm: $(sudo -u "$DEPLOY_USER" pnpm -v)"

echo "[5/8] 安装 Docker + Compose..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
apt-get install -y docker-compose-plugin 2>/dev/null || true
usermod -aG docker "$DEPLOY_USER" 2>/dev/null || true
echo "  Docker: $(docker -v)"
echo "  Compose: $(docker compose version 2>/dev/null || echo '未检测到插件')"

echo "[6/8] 安装 Nginx + Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx python3 python3-venv python3-pip
systemctl enable nginx

echo "[7/8] 安装 PM2..."
npm install -g pm2

echo "[8/9] 配置 swap（2G，缓解编译内存不足）..."
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  swap: 2G 已启用"
else
  echo "  swap: 已存在"
fi

echo "[9/9] 配置 UFW 防火墙..."
ufw allow OpenSSH 2>/dev/null || ufw allow 22/tcp || true
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable 2>/dev/null || true
ufw status || true

echo ""
echo "========================================"
echo "  初始化完成"
echo "========================================"
echo "  1. 退出并重新 SSH 登录（使 docker 组生效）"
echo "  2. 克隆代码: cd /opt && git clone <仓库> douxing"
echo "  3. cp deploy/env.production.example .env 并编辑"
echo "  4. pnpm deploy:server"
echo "  5. 见 docs/deploy-production.md 配置 Nginx + HTTPS"
echo "========================================"
