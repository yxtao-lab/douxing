# 兜行 · scripts 目录说明

> 根目录 `package.json` 里的 `pnpm xxx` 命令，多数会转发到本目录下的脚本。  
> 日常只需记住：**开发 `pnpm dev`**、**查环境 `pnpm env:status`**、**部署 `pnpm bootstrap` / `pnpm deploy:server`**。  
> **发版流程原理** → [docs/发版流程与CI-CD解析.md](../docs/发版流程与CI-CD解析.md) · **命令速查** → [docs/服务端命令手册.md](../docs/服务端命令手册.md)  
> **最后更新**：2026-06-23

---

## 1. 日常开发（最常用）

| 脚本 | 对应命令 | 作用 |
|------|----------|------|
| `run-dev-all.mjs` | `pnpm dev` | 并行启动 API、AI、Web、PC、H5、小程序、Android dev |
| `run-dev.mjs` | `pnpm dev:only <平台>` | 按需启动部分平台（如 `server,web`） |
| `run-ai-service.mjs` | `pnpm dev:ai-service` | 启动 Python AI 微服务（FastAPI，默认 `:8100`） |
| `dev-web.mjs` | `pnpm dev:web` / `pnpm dev:admin` | Web 管理端 dev + 就绪后自动打开浏览器（`:5173`） |
| `dev-pc.mjs` | `pnpm dev:pc` | PC 用户端 dev + 就绪后自动打开浏览器（`:5176`） |
| `dev-mp-weixin.mjs` | `pnpm dev:mp-weixin` | 小程序 dev 编译 + 自动打开微信开发者工具 |
| `env-status.mjs` | `pnpm env:status` | 查看当前各环境 API 地址与配置文件 |
| `stop.mjs` | `pnpm stop` / `stop:dev` / `stop:docker` | 停止 dev 端口占用 / Docker 容器 |

**说明：** `pnpm dev:with-ai` 与 `pnpm dev` 等价（均调用 `run-dev-all.mjs`）。

---

## 2. 构建

| 脚本 | 对应命令 | 作用 |
|------|----------|------|
| `run-build.mjs` | `pnpm build:only <平台>` | 按需构建指定端（如 `web,mobile`） |
| `chain-pkg-scripts.mjs` | mobile 子包内部 | 链式执行多个 build 脚本（H5 + 小程序等） |
| `platforms.mjs` | （被 run-dev / run-build 引用） | 多端平台定义：端口、build 命令、产物路径 |

---

## 3. 本地初始化与数据库

| 脚本 | 对应命令 | 作用 |
|------|----------|------|
| `deploy.mjs` | `pnpm bootstrap` / `bootstrap:dev` | 一键：装依赖 → Docker MySQL → 迁移 → 种子 → 可选构建 → 可选 dev |
| `fix-mysql-password.mjs` | `pnpm fix:mysql-password` | 同步 Docker MySQL 密码与 `.env`（改密码后常用） |

---

## 4. 部署（服务器 / 原生 App）

| 脚本 | 对应命令 | 作用 |
|------|----------|------|
| `deploy-server.mjs` | `pnpm deploy:server` | 生产/测试机：Docker、构建、迁移、PM2、Nginx |
| `deploy-release.mjs` | `pnpm deploy:release` | 统一发版：按 `--target=` 调度 server / pc / web |
| `deploy-pc-site.sh` | `pnpm deploy:pc-site` | PC 用户端：构建 + 复制到 `static/pc` + Nginx |
| `deploy-web-site.sh` | `pnpm deploy:web-site` | Web 管理端：构建 + 复制到 `static/web` + Nginx |
| `deploy-static-sites.sh` | `pnpm deploy:static-sites` | PC + Web 静态站点一键部署 |
| `deploy-app.mjs` | `pnpm deploy:app` | 原生 App 资源构建 + 可选后端 + 可选 dev |

### 4.1 CI/CD 与 Webhook 发版

| 脚本 | 对应命令 | 作用 |
|------|----------|------|
| `gitee-webhook-server.mjs` | `pnpm webhook:serve` | 监听 Gitee Push Hook（`:9090`），spawn 后台发版 |
| `gitee-webhook-deploy.sh` | （Webhook / 手动） | `git pull` → install → 检测 target → `deploy:release` |
| `detect-deploy-targets.mjs` | `pnpm detect:deploy-targets` | 按变更 package 计算发版目标（server/pc/web） |
| `ci-build.sh` | `pnpm build:ci` | 与云端 CI 相同的本地构建自检 |
| `install-webhook-service.sh` | （服务器手动） | 安装 systemd `douxing-webhook` + Nginx snippet |
| `verify-webhook-nginx.sh` | （服务器手动） | 检查 Webhook 反代是否生效 |
| `install-nginx-pc.sh` | `pnpm setup:nginx-pc` | PC 用户端 Nginx 站点模板 |
| `install-nginx-web.sh` | `pnpm setup:nginx-web` | Web 管理端 Nginx 站点模板 |

详细原理见 [docs/发版流程与CI-CD解析.md](../docs/发版流程与CI-CD解析.md)。

专项文档：

| 文档 | 内容 |
|------|------|
| [mp-weixin.md](./mp-weixin.md) | 微信小程序 dev / 打包 / 合法域名 |
| [app-native.md](./app-native.md) | Android / iOS 构建与上架 |

---

## 5. 服务器环境（Linux，在云上执行）

| 脚本 | 对应命令 | 作用 |
|------|----------|------|
| `setup-debian12.sh` | `pnpm setup:debian12` | Debian 12 一键装 Node、Docker、pnpm、PM2 等 |
| `setup-ubuntu22.sh` | `pnpm setup:ubuntu22` | Ubuntu 22.04 同上 |
| `setup-opencloudos9.sh` | `pnpm setup:opencloudos9` | OpenCloudOS 9 同上 |
| `install-nginx-conf.sh` | `pnpm setup:nginx-conf` | 安装 HTTP Nginx 反代配置 |
| `install-nginx-ssl.sh` | `pnpm setup:nginx-ssl` | 使用已有证书配置 HTTPS |
| `install-nginx-certbot.sh` | `pnpm setup:nginx-certbot` | Certbot 自动申请 Let's Encrypt |
| `install-nginx-auto.sh` | （`deploy-server` 内部调用） | 自动选择 conf / certbot / ssl 流程 |
| `diagnose-server.sh` | `pnpm diagnose:server` | 排查 API / Docker / PM2 / Nginx 故障 |
| `add-swap.sh` | `sudo bash scripts/add-swap.sh` | 低内存机器加 swap（缓解 tsc OOM） |

---

## 6. 工具库（不直接运行）

| 文件 | 作用 |
|------|------|
| `pm.mjs` | 统一 pnpm / npm 命令转发（全仓库根脚本依赖它） |
| `lib/load-root-env.mjs` | 按 Vite 优先级加载 `.env` 系列（小程序 dev 等） |
| `lib/wechat-devtools.mjs` | 检测并调用微信开发者工具 CLI |
| `setup-wechat-devtools.mjs` | `pnpm setup:wechat-devtools`：检测 CLI 并写入 `.env.local` |

---

## 7. 后端运维脚本（`packages/server/src/scripts/`）

由根目录 `pnpm` 命令转发，不在 `scripts/` 根目录，但属于同一类「脚本」：

| 根命令 | 源文件 | 作用 |
|--------|--------|------|
| `pnpm enrich:attraction-images` | `enrich-attraction-images.ts` | 批量补全景点封面（高德 POI 图） |
| `pnpm cleanup:orphan-covers` | `cleanup-orphan-attraction-covers.ts` | 清理无引用封面文件 |
| `pnpm migrate:covers-to-oss` | `migrate-attraction-covers-to-oss.ts` | 本地封面上传 OSS |
| `pnpm ml:generate-dataset` | `generate-training-dataset.ts` | DeepSeek 生成训练集 JSONL |
| `pnpm ml:validate-dataset` | `validate-training-dataset.ts` | 校验训练集格式并划分 train/val |
| `pnpm ml:upload-dataset` | `upload-training-dataset-to-oss.ts` | 上传 train/val 至 OSS + 生成 PAI manifest |
| `pnpm analytics:rollup` | `analytics-rollup.ts` | DT2 指标日汇总（`--backfill N` 回填） |
| `pnpm --filter @douxing/server dt2:analytics-cases` | `dt2-analytics-cases.ts` | DT2 日汇总验收 |
| `pnpm --filter @douxing/server dt3:analytics-cases` | `dt3-analytics-cases.ts` | DT3 客户端埋点验收 |
| `pnpm --filter @douxing/server dt5:analytics-cases` | `dt5-analytics-cases.ts` | DT5 旅行运营大屏验收 |
| `pnpm --filter @douxing/server s1:rbac-cases` | `s1-rbac-cases.ts` | S1 RBAC 闭环验收 |
| `pnpm --filter @douxing/server s2:dynamic-menu-cases` | `s2-dynamic-menu-cases.ts` | S2 动态菜单验收 |
| `pnpm --filter @douxing/server dev:self-check` | `dev-self-check.ts` | 开发环境联调自检 |
| `pnpm --filter @douxing/server i2:pai-lora-cases` | `i2-pai-lora-cases.ts` | I2 Step 35 本地验收（可选 `--verify-oss`） |
| `pnpm --filter @douxing/server agent:intent-cases` | `agent-intent-cases.ts` | Agent 追问意图路由用例 |
| `pnpm --filter @douxing/server agent:equivalence-cases` | `agent-equivalence-cases.ts` | 管道 vs Agent 等价率 |
| `pnpm --filter @douxing/server h5:m5-accept` | `h5-m5-accept.ts` | M5 行中智能一键验收 |
| `pnpm --filter @douxing/server langfuse:smoke` | `langfuse-smoke.ts` | Langfuse 观测冒烟 |
| `pnpm --filter @douxing/server enricher:demo` | `enricher-demo.ts` | 本地 Enricher 演示（不经过 HTTP） |

---

## 8. 已删除的临时 / 冗余文件

以下文件已移除，请改用对应命令：

| 已删除 | 原因 | 改用 |
|--------|------|------|
| `deploy.sh` / `deploy.ps1` | 仅 4 行包装 | `pnpm bootstrap` |
| `stop.sh` / `stop.ps1` | 仅 4 行包装 | `pnpm stop` |
| `format-design-doc.mjs` | 一次性 Word→Markdown 转换 | 直接维护 `docs/详细设计文档.md` |
| `postprocess-design-doc.py` | 上者配套后处理 | 同上 |

---

## 9. 命令 → 脚本 速查

```
pnpm dev                    → run-dev-all.mjs（Web :5173 + PC :5176 自动打开浏览器）
pnpm dev:web                → dev-web.mjs
pnpm dev:pc                 → dev-pc.mjs
pnpm dev:admin              → run-dev.mjs server,web
pnpm dev:only server,web    → run-dev.mjs
pnpm dev:mp-weixin          → dev-mp-weixin.mjs
pnpm dev:ai-service         → run-ai-service.mjs
pnpm env:status             → env-status.mjs
pnpm build:only web         → run-build.mjs
pnpm bootstrap              → deploy.mjs
pnpm deploy:server          → deploy-server.mjs
pnpm deploy:release         → deploy-release.mjs
pnpm deploy:pc-site         → deploy-pc-site.sh
pnpm deploy:web-site        → deploy-web-site.sh
pnpm webhook:serve          → gitee-webhook-server.mjs
pnpm detect:deploy-targets  → detect-deploy-targets.mjs
pnpm build:ci               → ci-build.sh
pnpm deploy:app             → deploy-app.mjs
pnpm stop                   → stop.mjs
pnpm fix:mysql-password     → fix-mysql-password.mjs
pnpm setup:wechat-devtools  → setup-wechat-devtools.mjs
```

环境变量说明见 [docs/env-environments.md](../docs/env-environments.md)；浏览器/开发者工具自启动见 [启动与部署流程 §3.4](../docs/启动与部署流程.md#34-浏览器自启动可选)。
