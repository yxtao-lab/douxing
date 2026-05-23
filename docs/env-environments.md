# 兜行 · 环境配置与打包说明

> 域名：`yxtao.site` · 生产 API：`https://api.yxtao.site` · 测试 API：`https://api-test.yxtao.site`

---

## 1. 环境文件一览

| 文件 | 用途 | 谁读取 |
|------|------|--------|
| `.env` | 本地开发 + **服务端运行时**（数据库、JWT、密钥等） | Node 后端、Docker |
| `.env.development` | 本地前端 API 地址 | Vite / UniApp（`pnpm dev:*`） |
| `.env.staging` | 测试环境前端 API 地址 | Vite / UniApp（`pnpm build:*:staging`） |
| `.env.production` | 生产环境前端 API 地址 | Vite / UniApp（`pnpm build:*`） |
| `deploy/env.staging.example` | 测试服务器完整后端配置模板 | 复制为服务器上的 `.env` |
| `deploy/env.production.example` | 生产服务器完整后端配置模板 | 复制为服务器上的 `.env` |

**要点**：`VITE_*` 在**打包时**写入小程序/H5/Web；`API_PUBLIC_BASE_URL` 等由**后端**读取，需在服务器 `.env` 中配置。

---

## 2. 三套环境 API 地址

| 环境 | 前端 API（VITE_API_BASE_URL） | 静态资源根（API_PUBLIC_BASE_URL） |
|------|------------------------------|-----------------------------------|
| 本地开发 | `http://127.0.0.1:3000/api` | `http://127.0.0.1:3000`（写在 `.env`） |
| 测试 | `https://api-test.yxtao.site/api` | `https://api-test.yxtao.site` |
| 生产 | `https://api.yxtao.site/api` | `https://api.yxtao.site` |

测试域名需在 DNS 添加 A 记录 `api-test` → 测试服务器 IP（可与生产同 IP，但建议独立数据库）。

---

## 3. 本地开发启动

```bash
cp .env.example .env          # 首次：配数据库、JWT 等
pnpm dev:server               # 后端 http://127.0.0.1:3000
pnpm dev:mp-weixin            # 小程序 → 自动读 .env.development
pnpm dev:web                  # 管理端
pnpm dev:mobile               # H5
```

小程序开发者工具导入：`packages/mobile/dist/dev/mp-weixin`  
勾选「不校验合法域名」；API 指向 `127.0.0.1`。

---

## 4. 测试环境

### 4.1 服务器（测试 API）

```bash
# 在测试机 / 或生产机第二套端口
cp deploy/env.staging.example .env
vim .env                      # 改密码、密钥；默认端口 3001

pnpm deploy:server
pnpm deploy:server --nginx api-test.yxtao.site --skip-docker --skip-build
# Nginx 配置同生产，见 deploy-production.md
```

微信公众平台 **request 合法域名** 添加：`https://api-test.yxtao.site`

### 4.2 本地打测试包（小程序体验版）

```bash
pnpm build:mp-weixin:staging
# 产物：packages/mobile/dist/build/mp-weixin
```

微信开发者工具导入 → **上传** → 公众平台设为 **体验版**。

其他端测试包：

```bash
pnpm build:web:staging
pnpm build:mobile:staging     # H5
pnpm build:app-all:staging    # 原生 App 资源
```

---

## 5. 生产环境

### 5.1 服务器（生产 API）

```bash
cp deploy/env.production.example .env
vim .env

pnpm deploy:server
pnpm deploy:server --nginx api.yxtao.site --skip-docker --skip-build
```

微信公众平台 **request 合法域名** 添加：`https://api.yxtao.site`

### 5.2 本地打生产包

```bash
pnpm build:mp-weixin
# 或显式：pnpm build:mp-weixin:prod（等价）

pnpm build:web
pnpm build:mobile
```

上传小程序 → **提交审核** → 发布正式版。

---

## 6. 命令速查

| 场景 | 命令 | 读取 env | 产物/效果 |
|------|------|----------|-----------|
| 本地开发小程序 | `pnpm dev:mp-weixin` | `.env.development` | `dist/dev/mp-weixin` |
| **测试**小程序包 | `pnpm build:mp-weixin:staging` | `.env.staging` | `dist/build/mp-weixin` |
| **生产**小程序包 | `pnpm build:mp-weixin` | `.env.production` | `dist/build/mp-weixin` |
| 测试 Web | `pnpm build:web:staging` | `.env.staging` | `packages/web/dist` |
| 生产 Web | `pnpm build:web` | `.env.production` | `packages/web/dist` |
| 本地后端 | `pnpm dev:server` | `.env` | `:3000` |
| 测试/生产后端 | `pnpm deploy:server` | 服务器 `.env` | PM2 + Docker |

---

## 7. 生产 vs 测试 差异摘要

| 维度 | 测试环境 | 生产环境 |
|------|----------|----------|
| 域名 | `api-test.yxtao.site` | `api.yxtao.site` |
| 前端 env | `.env.staging` | `.env.production` |
| 后端模板 | `deploy/env.staging.example` | `deploy/env.production.example` |
| 默认端口 | `3001`（可改） | `3000` |
| 数据库 | `douxing_staging` | `douxing` |
| 短信 | 建议 `mock` | `tencent` |
| 验证码调试 | 可开 `SMS_DEV_EXPOSE_CODE` | 必须关闭 |
| 打卡围栏 | 可关闭 | 建议开启 |
| 小程序发布 | 体验版 | 正式版（需审核） |
| 打包命令 | `build:*:staging` | `build:*` |

---

## 8. 常见问题

**改 env 后小程序仍请求旧地址？**  
必须重新执行对应的 `build` 或重启 `dev:mp-weixin`，再重新导入开发者工具。`uni.uploadFile` 与 `request` 共用 `VITE_API_BASE_URL`，真机勿用 `127.0.0.1`。

**真机 uploadFile 连 127.0.0.1:3000？**  
说明当前是**开发编译包**且未配 HTTPS API。任选其一：

```bash
# 方案 A：打生产包（推荐）
pnpm build:mp-weixin
# 导入 packages/mobile/dist/build/mp-weixin

# 方案 B：继续 dev 编译但真机预览
cp .env.development.local.example .env.development.local
pnpm dev:mp-weixin
```

并确认微信公众平台已配置 **uploadFile 合法域名**：`https://api.yxtao.site`

**只有一台服务器？**  
测试与生产可同机不同端口 + 两个 Nginx `server_name`；数据库务必分库。暂无 `api-test` 解析时，可临时把 `.env.staging` 改成生产域名，但勿长期混用。

**`.env.production` 会提交 Git 吗？**  
当前仅含公开 URL，已纳入版本库；密钥只放在服务器 `.env` 或本地 `.env`（gitignore）。

**头像报 HTTP / 127.0.0.1 不再支持？**

头像在数据库中仅存相对路径（如 `/uploads/avatars/xxx.jpg`），接口返回时按 `API_PUBLIC_BASE_URL` 动态拼 HTTPS 地址。请确认：

1. 服务器 `.env`：`API_PUBLIC_BASE_URL=https://api.yxtao.site`，然后 `pnpm deploy:server --skip-docker --skip-build`
2. 微信公众平台 **downloadFile / uploadFile 合法域名**：`https://api.yxtao.site`
3. 图片文件在服务器 `packages/server/uploads/` 目录，或小程序内重新上传
4. 旧数据若仍存完整 localhost URL，读取时会自动规范化，下次保存会写入相对路径
