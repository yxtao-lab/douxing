# 兜行 · 生产环境部署指南（Debian 12 · 腾讯云轻量）

> **推荐系统**：Debian 12（bookworm）64 位（重装轻量服务器时选此镜像）  
> 将 API 公有化：域名 + HTTPS + Nginx 反代 + PM2 + Docker（MySQL/Redis）  
> 示例域名：`api.yxtao.site`（请替换为你的域名）

**关联文档**：[环境配置与打包说明](env-environments.md) · [微信小程序部署](../scripts/mp-weixin.md)

---

## 目录

1. [前置条件](#1-前置条件)
2. [架构概览](#2-架构概览)
3. [从零部署检查表（推荐照着做）](#3-从零部署检查表推荐照着做)
4. [服务器初始化](#4-服务器初始化)
5. [代码与配置](#5-代码与配置)
6. [DNS 与防火墙](#6-dns-与防火墙)
7. [部署 API](#7-部署-api)
8. [Nginx + HTTPS](#8-nginx--https)
9. [微信小程序](#9-微信小程序)
10. [日常运维](#10-日常运维)
11. [常见问题](#11-常见问题)
12. [安全清单](#12-安全清单)

---

## 1. 前置条件

| 项目 | 要求 |
|------|------|
| 云服务器 | 腾讯云轻量应用服务器，**2C4G** 起，磁盘 **60GB+** |
| 操作系统 | **Debian 12（bookworm）** 64 bit |
| 域名 | 已备案；子域名如 `api.yxtao.site` |
| 本地 | 项目可 `pnpm dev:server`；Git 仓库可访问 |
| 小程序 | 须 **HTTPS** + 微信公众平台合法域名 |

Debian 12 与 Ubuntu 同属 **Debian 系**：使用 `apt`、Nginx `sites-available/sites-enabled`、UFW，部署步骤一致。

---

## 2. 架构概览

```mermaid
flowchart LR
  Client[小程序 / H5] -->|HTTPS 443| Nginx
  Nginx -->|127.0.0.1:3000| API[Node + PM2]
  API --> MySQL[(MySQL Docker)]
  API --> Redis[(Redis Docker)]
  API --> DeepSeek[DeepSeek API]
```

- 对外仅 **80 / 443**；MySQL、Redis 只监听 **127.0.0.1**
- 头像/打卡图：DB 存相对路径 `/uploads/...`，接口按 `API_PUBLIC_BASE_URL` 动态拼 URL

---

## 3. 从零部署检查表（推荐照着做）

重装 Debian 12 后，SSH 登录，按顺序打勾：

```
[ ] 1. 腾讯云控制台 → 防火墙放行 22、80、443
[ ] 2. sudo bash scripts/setup-debian12.sh → 重新登录 SSH
[ ] 3. git clone 到 /opt/douxing
[ ] 4. cp deploy/env.production.example .env 并改密码/域名/密钥
[ ] 5. pnpm deploy:server
[ ] 6. curl http://127.0.0.1:3000/api/health  → JSON
[ ] 7. DNS：api → 服务器公网 IP
[ ] 8. Nginx + certbot（见第 8 节）
[ ] 9. curl https://api.yxtao.site/api/health  → JSON
[ ] 10. 微信合法域名 + 本地 pnpm build:mp-weixin
[ ] 11. pm2 startup && pm2 save
```

**预期**：第 6 步失败 = 先修 API，不要配 Nginx；第 9 步 404 = Nginx 未反代到 3000。

---

## 4. 服务器初始化

### 4.1 腾讯云重装系统

1. 轻量控制台 → 服务器 → **重装系统**
2. 镜像选择：**Debian 12**（或 Debian 12 bookworm）
3. 记下新的 **公网 IP**（DNS 需更新）

### 4.2 一键初始化（推荐）

```bash
cd /opt
sudo mkdir -p douxing && sudo chown "$USER:$USER" douxing
git clone <你的仓库地址> douxing
cd douxing

sudo bash scripts/setup-debian12.sh
# 务必重新 SSH 登录一次（docker 组）
```

### 4.3 手动安装（与脚本等价）

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl vim nginx certbot python3-certbot-nginx ufw sudo

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
corepack enable && corepack prepare pnpm@9.15.0 --activate

curl -fsSL https://get.docker.com | sudo sh
sudo apt install -y docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
# 重新 SSH 登录

sudo npm install -g pm2

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 5. 代码与配置

### 5.1 获取代码

```bash
cd /opt/douxing
git pull
# 若 pnpm-lock.yaml 冲突：
# git checkout -- pnpm-lock.yaml && git pull
```

### 5.2 生产 `.env`

```bash
cp deploy/env.production.example .env
nano .env
```

**必改项**（示例域名 `api.yxtao.site`）：

```env
NODE_ENV=production
SERVER_PORT=3000

API_PUBLIC_BASE_URL=https://api.yxtao.site
VITE_API_BASE_URL=https://api.yxtao.site/api

MYSQL_ROOT_PASSWORD=强密码
MYSQL_PASSWORD=强密码
DATABASE_URL=mysql://douxing:同上密码@127.0.0.1:3307/douxing

JWT_SECRET=至少32位随机字符串

LLM_DEFAULT_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx

SMS_PROVIDER=tencent
SMS_DEV_EXPOSE_CODE=false
```

微信支付上线时补充 `WECHAT_PAY_*`、`WECHAT_PAY_NOTIFY_URL=https://api.yxtao.site/api/payments/wechat/notify`。

---

## 6. DNS 与防火墙

### 6.1 DNS

| 类型 | 主机记录 | 记录值 |
|------|----------|--------|
| A | api | 服务器公网 IP |

验证：`ping api.yxtao.site`

### 6.2 防火墙（两层都要开）

| 位置 | 端口 |
|------|------|
| 腾讯云轻量控制台 → 防火墙 | **22、80、443** |
| 系统 UFW（setup 脚本已配置） | 22、80、443 |

---

## 7. 部署 API

```bash
cd /opt/douxing
pnpm deploy:server
```

可选演示数据：`pnpm db:seed`

### 7.1 验证（必须通过后再配 Nginx）

```bash
pnpm exec pm2 status
curl http://127.0.0.1:3000/api/health
bash scripts/diagnose-server.sh
```

失败时：

```bash
pnpm exec pm2 logs douxing-api --lines 50
pnpm build:server && pnpm deploy:server --skip-docker
```

### 7.2 PM2 开机自启

```bash
pnpm exec pm2 startup
# 执行输出的 sudo 命令
pnpm exec pm2 save
```

---

## 8. Nginx + HTTPS

### 8.1 生成站点配置

```bash
pnpm deploy:server --nginx api.yxtao.site --skip-docker --skip-build
```

### 8.2 安装并重载（Debian / Ubuntu 标准路径）

```bash
sudo cp deploy/nginx/douxing-api.conf /etc/nginx/sites-available/douxing-api
sudo ln -sf /etc/nginx/sites-available/douxing-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx
```

### 8.3 申请 SSL 证书

```bash
sudo certbot --nginx -d api.yxtao.site
```

### 8.4 验证

```bash
curl https://api.yxtao.site/api/health
curl -X POST https://api.yxtao.site/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"admin123"}'
```

证书续期测试：`sudo certbot renew --dry-run`

---

## 9. 微信小程序

### 9.1 公众平台域名

| 类型 | 填写 |
|------|------|
| request 合法域名 | `https://api.yxtao.site` |
| uploadFile 合法域名 | `https://api.yxtao.site` |
| downloadFile 合法域名 | `https://api.yxtao.site` |

### 9.2 本地打生产包

```bash
pnpm build:mp-weixin
```

导入 `packages/mobile/dist/build/mp-weixin`。详见 [env-environments.md](env-environments.md)。

---

## 10. 日常运维

| 操作 | 命令 |
|------|------|
| 诊断 | `bash scripts/diagnose-server.sh` |
| 查看日志 | `pnpm exec pm2 logs douxing-api` |
| 更新部署 | `git checkout -- pnpm-lock.yaml && git pull && pnpm deploy:server` |
| 仅重启 API | `pnpm deploy:server --skip-docker --skip-build` |
| MySQL 备份 | `docker exec douxing-mysql mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" douxing > backup.sql` |

---

## 11. 常见问题

### 本机 3000 连接失败

```bash
bash scripts/diagnose-server.sh
pnpm build:server   # 会先构建 @douxing/shared 再构建 server
pnpm deploy:server --skip-docker
pnpm exec pm2 logs douxing-api --lines 50
```

PM2 日志若出现 `Cannot find module ... packages/shared/src/types.js`：

```bash
pnpm --filter @douxing/shared build
pnpm build:server
pnpm deploy:server --skip-docker --skip-build
```

### 公网 /api/health 返回 Nginx 404

1. 本机 `curl http://127.0.0.1:3000/api/health` 须正常
2. 已启用 `sites-enabled/douxing-api` 并移除 `default`
3. `sudo nginx -t && sudo systemctl reload nginx`

### docker compose 不存在

```bash
sudo apt install -y docker-compose-plugin
sudo systemctl restart docker
docker compose version
```

### pm2 找不到

```bash
pnpm install && pnpm exec pm2 -v
pnpm deploy:server --skip-docker --skip-build
```

已是 root 时勿 `sudo npm install -g pm2`。

### git pull 冲突 pnpm-lock.yaml

```bash
git checkout -- pnpm-lock.yaml && git pull && pnpm install
```

### 小程序仍连 127.0.0.1

使用 `pnpm build:mp-weixin` 生产包，见 [env-environments.md](env-environments.md)。

---

## 12. 安全清单

- [ ] 强密码：`JWT_SECRET`、`MYSQL_*`
- [ ] 关闭 `SMS_DEV_EXPOSE_CODE`
- [ ] SSH 密钥登录（可选）
- [ ] 定期 `sudo apt update && sudo apt upgrade -y`
- [ ] MySQL/Redis 不暴露公网

---

## 附录 A：其他系统

<details>
<summary>Ubuntu 22.04 / 24.04（步骤相同，换初始化脚本）</summary>

```bash
sudo bash scripts/setup-ubuntu22.sh
```

其余 Nginx、certbot、`pnpm deploy:server` 与 Debian 12 完全一致。

</details>

<details>
<summary>OpenCloudOS 9 / RHEL 系（非推荐）</summary>

- 初始化：`sudo bash scripts/setup-opencloudos9.sh`
- Nginx：`sudo bash scripts/install-nginx-conf.sh api.yxtao.site`
- 包管理：`dnf`，勿用 `apt`

</details>

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `scripts/setup-debian12.sh` | **Debian 12 一键环境** |
| `scripts/setup-ubuntu22.sh` | Ubuntu 22.04 一键环境 |
| `scripts/deploy-server.mjs` | API 部署 |
| `scripts/diagnose-server.sh` | 故障诊断 |
| `deploy/env.production.example` | 生产 `.env` 模板 |
