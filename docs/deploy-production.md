# 兜行 · 生产环境部署指南（腾讯云轻量服务器）

> 将本地 API 公有化：域名 + HTTPS + Nginx 反代 + PM2 守护进程  
> 适用场景：微信小程序上线、真机调试、微信支付回调

---

## 1. 前置条件

| 项目 | 要求 |
|------|------|
| 服务器 | 腾讯云轻量应用服务器（建议 2C4G 及以上） |
| 系统 | **OpenCloudOS 9**（腾讯云轻量常见）；亦兼容 Ubuntu 22.04 |
| 域名 | 已备案，并可在 DNS 控制台添加 A 记录 |
| 子域名 | 建议 `api.你的域名.com` 指向服务器公网 IP |
| 本地 | 已能 `pnpm dev:server` 正常运行 |

**小程序上线硬性要求**：API 必须 **HTTPS**，域名须在微信公众平台配置 **request 合法域名**。

---

## 2. 架构概览

```mermaid
flowchart LR
  Client[小程序 / H5 / App] -->|HTTPS 443| Nginx
  Nginx -->|HTTP 127.0.0.1:3000| API[Node API / PM2]
  API --> MySQL[(MySQL Docker)]
  API --> Redis[(Redis Docker)]
  API -.可选.-> AI[Python AI :8100]
  API --> DeepSeek[DeepSeek API]
```

- 对外只暴露 **80 / 443**，MySQL / Redis **仅本机访问**
- 静态上传（头像、打卡图）经 Nginx 转发到 Node 的 `/uploads/` 路径

---

## 3. 服务器初始化（OpenCloudOS 9）

OpenCloudOS 9 使用 **dnf** 包管理器，防火墙为 **firewalld**，Nginx 站点配置放在 `/etc/nginx/conf.d/`（非 Debian 的 sites-available 目录）。

### 3.1 一键脚本（推荐）

SSH 登录服务器，克隆代码后：

```bash
cd /opt/douxing
sudo bash scripts/setup-opencloudos9.sh
# 重新登录 SSH 使 docker 组生效
```

### 3.2 手动安装

```bash
# 更新系统
sudo dnf makecache -y && sudo dnf upgrade -y

# 基础工具
sudo dnf install -y git curl wget vim tar gzip

# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
corepack enable
corepack prepare pnpm@9.15.0 --activate

# Docker（版本须 > 20.10.9，OpenCloudOS 官方要求）
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新登录 SSH

# EPEL + Nginx + Certbot
sudo dnf install -y epel-release
sudo dnf install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx

# PM2 + Python（AI 微服务可选）
sudo npm install -g pm2
sudo dnf install -y python3 python3-pip

# 防火墙放行 80/443（若 firewalld 已启用）
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# SELinux 允许 Nginx 反代本机 Node（若 getenforce 为 Enforcing）
sudo setsebool -P httpd_can_network_connect 1
```

### 3.3 Ubuntu / Debian 参考

<details>
<summary>点击展开 Ubuntu 22.04 命令</summary>

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx certbot python3-certbot-nginx python3 python3-venv python3-pip
corepack enable && corepack prepare pnpm@9.15.0 --activate
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
sudo npm install -g pm2
```

Nginx 站点路径使用 `/etc/nginx/sites-available/` + `sites-enabled/`（见下文 8.2）。

</details>

---

## 4. 上传代码

**方式 A：Git 克隆（推荐）**

```bash
cd /opt
sudo mkdir -p douxing && sudo chown $USER:$USER douxing
git clone <你的仓库地址> douxing
cd douxing
```

**方式 B：本地 rsync 同步**

在本地项目根目录执行（替换 IP 和路径）：

```bash
rsync -avz --exclude node_modules --exclude .git --exclude packages/*/dist \
  ./ root@你的服务器IP:/opt/douxing/
```

---

## 5. 配置生产环境变量

```bash
cd /opt/douxing
cp deploy/env.production.example .env
nano .env   # 或 vim
```

**必须修改的项**：

```env
API_PUBLIC_BASE_URL=https://api.你的域名.com
VITE_API_BASE_URL=https://api.你的域名.com/api

MYSQL_ROOT_PASSWORD=强密码
MYSQL_PASSWORD=强密码
DATABASE_URL=mysql://douxing:同上密码@127.0.0.1:3307/douxing

JWT_SECRET=至少32位随机字符串

# 生产 LLM（勿用 127.0.0.1 LM Studio）
LLM_DEFAULT_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx

# 短信
SMS_PROVIDER=tencent
SMS_DEV_EXPOSE_CODE=false
```

微信支付上线时还需配置 `WECHAT_PAY_*` 与 `WECHAT_PAY_NOTIFY_URL`。

---

## 6. DNS 解析

在域名 DNS 控制台添加：

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| A | api | 轻量服务器公网 IP |

等待解析生效（通常 5～30 分钟），验证：

```bash
ping api.你的域名.com
```

---

## 7. 一键部署 API

```bash
cd /opt/douxing
pnpm deploy:server
```

首次部署后初始化演示数据（可选）：

```bash
pnpm db:seed
```

检查服务：

```bash
curl http://127.0.0.1:3000/api/health
pm2 status
```

---

## 8. 配置 Nginx + HTTPS

```bash
# 生成 Nginx 配置（替换为你的 API 域名）
pnpm deploy:server --nginx api.你的域名.com --skip-docker --skip-build
```

### 8.1 OpenCloudOS 9（conf.d 方式）

```bash
sudo cp deploy/nginx/douxing-api.conf /etc/nginx/conf.d/douxing-api.conf
# 若默认站点冲突，可移除：sudo rm -f /etc/nginx/conf.d/default.conf

sudo certbot --nginx -d api.你的域名.com
sudo nginx -t && sudo systemctl reload nginx
```

### 8.2 Ubuntu / Debian（sites-available 方式）

```bash
sudo cp deploy/nginx/douxing-api.conf /etc/nginx/sites-available/douxing-api
sudo ln -sf /etc/nginx/sites-available/douxing-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo certbot --nginx -d api.你的域名.com
sudo nginx -t && sudo systemctl reload nginx
```

验证 HTTPS：

```bash
curl https://api.你的域名.com/api/health
```

Certbot 会自动配置证书续期；可手动测试：`sudo certbot renew --dry-run`

**腾讯云防火墙**：在轻量控制台「防火墙」中放行 **80、443** 端口（与系统 firewalld 是两层，都需放行）。

### OpenCloudOS 9 502 / 连接被拒绝

若 HTTPS 能访问但返回 502，常见原因：

1. PM2 未启动：`pm2 status`，确认 `douxing-api` 为 online
2. SELinux 拦截：`sudo setsebool -P httpd_can_network_connect 1`
3. 端口不一致：`.env` 中 `SERVER_PORT` 与 Nginx 模板中的端口一致（默认 3000）

---

## 9. 微信小程序配置

### 9.1 公众平台

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. **开发 → 开发管理 → 开发设置 → 服务器域名**
3. **request 合法域名** 添加：`https://api.你的域名.com`（不带路径）

### 9.2 本地构建生产包

在**本地** `.env` 中设置：

```env
VITE_API_BASE_URL=https://api.你的域名.com/api
```

然后：

```bash
pnpm build:mp-weixin
```

用微信开发者工具导入 `packages/mobile/dist/build/mp-weixin`，上传并提交审核。

---

## 10. 日常运维

| 操作 | 命令 |
|------|------|
| 查看 API 日志 | `pm2 logs douxing-api` |
| 重启 API | `pm2 restart douxing-api` |
| 更新代码后重新部署 | `git pull && pnpm deploy:server` |
| 仅重载进程 | `pnpm deploy:server --skip-docker --skip-build` |
| 环境检查 | `pnpm deploy:server:check` |
| MySQL 备份 | `docker exec douxing-mysql mysqldump -u root -p$MYSQL_ROOT_PASSWORD douxing > backup.sql` |

PM2 开机自启（首次部署后执行一次）：

```bash
pm2 startup
# 按提示执行输出的 sudo 命令
pm2 save
```

---

## 11. 常见问题

### 小程序「网络请求失败」

1. `VITE_API_BASE_URL` 是否为 HTTPS 且与合法域名一致
2. 公众平台是否已配置 request 域名（生效需数分钟）
3. 服务器防火墙是否放行 443
4. `curl https://api.你的域名.com/api/health` 是否返回 JSON

### 头像 / 打卡图无法显示

确认 `.env` 中：

```env
API_PUBLIC_BASE_URL=https://api.你的域名.com
```

头像 URL 形如 `https://api.你的域名.com/uploads/avatars/xxx.jpg`。

### 微信支付回调失败

- `WECHAT_PAY_NOTIFY_URL` 必须是 **HTTPS 公网可访问**
- 商户平台配置的回调 URL 与 `.env` 一致
- 查看 `pm2 logs douxing-api` 中的 notify 日志

### LLM 路线生成超时

Nginx 模板已设置 `proxy_read_timeout 180s`。若仍超时，检查 DeepSeek API Key 与网络连通性。

---

## 12. 安全清单

- [ ] 修改默认 `JWT_SECRET`、`MYSQL_*` 密码
- [ ] 关闭 `SMS_DEV_EXPOSE_CODE`
- [ ] MySQL / Redis 仅绑定 `127.0.0.1`（`deploy/docker-compose.prod.yml` 已配置）
- [ ] 服务器 SSH 改用密钥登录，禁用 root 密码登录
- [ ] 定期 `dnf upgrade`（OpenCloudOS）或 `apt upgrade`（Ubuntu）与 Docker 镜像更新

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `deploy/env.production.example` | 生产 `.env` 模板 |
| `deploy/docker-compose.prod.yml` | MySQL + Redis |
| `deploy/ecosystem.config.cjs` | PM2 进程配置 |
| `deploy/nginx/douxing-api.conf.template` | Nginx 模板 |
| `scripts/deploy-server.mjs` | 服务器部署脚本 |
