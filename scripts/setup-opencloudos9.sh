#!/usr/bin/env bash
# 兜行 · OpenCloudOS 9 服务器环境初始化
# 用法: sudo bash scripts/setup-opencloudos9.sh
# 在 SSH 登录轻量服务器后，于项目根目录或克隆后执行
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "请使用 root 或 sudo 执行: sudo bash scripts/setup-opencloudos9.sh"
  exit 1
fi

echo "========================================"
echo "  兜行 · OpenCloudOS 9 环境初始化"
echo "========================================"

echo "[1/7] 更新系统..."
dnf makecache -y
dnf upgrade -y

echo "[2/7] 安装基础工具..."
dnf install -y git curl wget vim tar gzip

echo "[3/7] 安装 Node.js 20..."
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]]; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  dnf install -y nodejs
fi
echo "  Node: $(node -v)"

echo "[4/7] 启用 pnpm..."
if id -u "${SUDO_USER:-root}" >/dev/null 2>&1; then
  DEPLOY_USER="${SUDO_USER}"
else
  DEPLOY_USER="$(logname 2>/dev/null || echo root)"
fi
sudo -u "$DEPLOY_USER" bash -lc 'corepack enable && corepack prepare pnpm@9.15.0 --activate'
echo "  pnpm: $(sudo -u "$DEPLOY_USER" pnpm -v)"

echo "[5/7] 安装 Docker + Compose 插件..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  echo "  安装 docker-compose-plugin..."
  if dnf install -y docker-compose-plugin 2>/dev/null; then
    systemctl restart docker
  else
    mkdir -p /usr/libexec/docker/cli-plugins
    ARCH="$(uname -m)"
    curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-${ARCH}" \
      -o /usr/libexec/docker/cli-plugins/docker-compose
    chmod +x /usr/libexec/docker/cli-plugins/docker-compose
    systemctl restart docker
  fi
fi

usermod -aG docker "$DEPLOY_USER" 2>/dev/null || true
echo "  Docker: $(docker -v)"
echo "  Compose: $(docker compose version 2>/dev/null || docker-compose version 2>/dev/null || echo '未安装')"

echo "[6/7] 安装 Nginx、Certbot、Python..."
# EPEL 提供 certbot；OpenCloudOS 9 与 RHEL 9 兼容
if ! rpm -q epel-release >/dev/null 2>&1; then
  dnf install -y epel-release || dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
fi
dnf install -y nginx certbot python3-certbot-nginx python3 python3-pip
systemctl enable nginx

echo "[7/7] 安装 PM2、配置防火墙与 SELinux..."
npm install -g pm2

# firewalld（若已启用）
if systemctl is-active firewalld >/dev/null 2>&1; then
  firewall-cmd --permanent --add-service=http
  firewall-cmd --permanent --add-service=https
  firewall-cmd --reload
  echo "  firewalld: 已放行 http/https"
fi

# 允许 Nginx 反代到本机 Node
if command -v getenforce >/dev/null 2>&1 && [[ "$(getenforce)" != "Disabled" ]]; then
  setsebool -P httpd_can_network_connect 1
  echo "  SELinux: 已允许 httpd 网络连接"
fi

echo ""
echo "========================================"
echo "  初始化完成"
echo "========================================"
echo "  1. 重新登录 SSH（使 docker 组生效）"
echo "  2. 上传/克隆代码到 /opt/douxing"
echo "  3. cp deploy/env.production.example .env 并编辑"
echo "  4. pnpm deploy:server"
echo "  5. pnpm deploy:server --nginx api.你的域名.com --skip-docker --skip-build"
echo "  6. 详见 docs/deploy-production.md"
echo "========================================"
