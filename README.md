# 兜行 (Douxing)

多端出行服务平台 Monorepo 脚手架。

## 技术栈

| 模块 | 技术 |
|------|------|
| 包管理 | pnpm workspace（推荐）；亦支持 npm workspaces |
| Web 管理端 | Vue 3 + Ant Design Vue + Vite（`:5173`） |
| PC 用户端 | Vue 3 + Tailwind + Vite（`:5176`） |
| 移动端 | UniApp (Vue 3) + Vite（H5 / 微信小程序 / Android / iOS App） |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MySQL 8 + Drizzle ORM |
| 共享 | `@douxing/shared` 类型与常量 |

## 项目文档

| 文档 | 链接 |
|------|------|
| 项目框架架构（AI 模板） | [docs/项目框架架构-AI模板.md](docs/项目框架架构-AI模板.md) · 配置 [`project.manifest.yaml`](project.manifest.yaml) |
| 包管理与 npm/pnpm 对照 | [docs/包管理与命令.md](docs/包管理与命令.md) |
| 详细设计（Markdown + §17 补充） | [docs/详细设计文档.md](docs/详细设计文档.md) |
| 功能路线图（含 S/M/F/K-A/P6 线） | [docs/ROADMAP.md](docs/ROADMAP.md) |
| 数据中台（DT 线） | [docs/数据中台.md](docs/数据中台.md) · [docs/旅行运营大屏.md](docs/旅行运营大屏.md) |
| 下一步工作（当前 Sprint） | [docs/下一步工作.md](docs/下一步工作.md) |
| API 接口文档 + OpenAPI | [docs/API接口文档.md](docs/API接口文档.md) · [docs/openapi.yaml](docs/openapi.yaml) |
| 旅程相册（J 线） | [docs/旅行照片存储系统.md](docs/旅行照片存储系统.md) |
| 旅行日记博客（K-A 线） | [docs/旅行日记博客.md](docs/旅行日记博客.md) |
| 用户粘性与旅友圈战略 | [docs/用户粘性与旅友圈战略.md](docs/用户粘性与旅友圈战略.md) |
| 项目概述与工作区说明 | [docs/项目概述.md](docs/项目概述.md) |
| 国际化规范 | [docs/国际化.md](docs/国际化.md) |
| Cursor Agent 规则（新页面 UI / 组件复用） | [docs/Cursor-Agent规则.md](docs/Cursor-Agent规则.md) |
| 文档索引 | [docs/README.md](docs/README.md) |
| 发版流程与 CI/CD | [docs/发版流程与CI-CD解析.md](docs/发版流程与CI-CD解析.md) |
| 服务端命令手册 | [docs/服务端命令手册.md](docs/服务端命令手册.md) |
| 启动与部署流程 | [docs/启动与部署流程.md](docs/启动与部署流程.md) |
| PC 双平台分工（用户端/管理端） | [docs/PC双平台分工.md](docs/PC双平台分工.md) |
| 系统管理（Web RBAC） | [docs/系统管理.md](docs/系统管理.md) |
| Web 管理端表格规范 | [docs/Web管理端表格规范.md](docs/Web管理端表格规范.md) |
| 发单接单平台（模块 B） | [docs/发单接单平台.md](docs/发单接单平台.md) · [docs/发单接单路线图.md](docs/发单接单路线图.md) |
| 数字孪生与三维建模（F 线） | [docs/数字孪生与三维建模.md](docs/数字孪生与三维建模.md) |
| AI 路径规划路线图（M1～M6 主链 · H10 Web 审核 ✅ · Step 35 延后） | [docs/AI路径规划路线图.md](docs/AI路径规划路线图.md) |
| AI 流程编排路线图（W0～W5 · 术语表 §12） | [docs/AI流程编排路线图.md](docs/AI流程编排路线图.md) |
| 发单接单路线图（M0～M7 · E2 接线 ✅ · 下一沙箱真机） | [docs/发单接单路线图.md](docs/发单接单路线图.md) |
| 后期待办（公司/对公办理中 · 商户号） | [docs/后期待办.md](docs/后期待办.md) |
| 专属模型训练（I2/I3） | [docs/阿里云-兜行专属模型训练与部署.md](docs/阿里云-兜行专属模型训练与部署.md) · [packages/ml-training/README.md](packages/ml-training/README.md) |
| AI 规划与 Agent 演进（设计全稿） | [docs/AI规划与Agent演进.md](docs/AI规划与Agent演进.md) |
| AI 旅行宠物（H3 线） | [docs/AI旅行宠物.md](docs/AI旅行宠物.md) |
| 精准化与人群定制（P-TAG/P-ONBOARD/P-INPUT/P-MEMORY/P-THEME/P-LIVE/P-DEMAND/P-PROFILE） | [docs/精准化与人群定制路线图.md](docs/精准化与人群定制路线图.md) |
| 品牌视觉规范（移动端 H1） | [docs/品牌视觉规范.md](docs/品牌视觉规范.md) |
| 移动端公共组件 | [docs/公共组件.md](docs/公共组件.md) |
| 移动端支付联调 | [docs/移动端支付联调说明.md](docs/移动端支付联调说明.md) |
| 原生 App 部署 | [scripts/app-native.md](scripts/app-native.md) |
| scripts 目录说明 | [scripts/README.md](scripts/README.md) |

未完成能力与分步实施计划见 **ROADMAP**（含模块 A 主链与 **S 系统管理** / **M 发单接单** / **精准化与人群定制** 线）。

## 目录结构

```
project/
├── packages/
│   ├── web/        # Vue3 Web 管理端（:5173）
│   ├── pc/         # Vue3 PC 用户端（:5176）
│   ├── mobile/     # UniApp 移动端
│   ├── server/     # Node 后端 API
│   ├── shared/     # 跨端共享类型
│   ├── ai-service/ # Python AI 微服务（可选，:8100）
│   └── ml-training/# 专属模型 LoRA 训练数据与配置
├── docs/         # 路线图等文档
├── scripts/      # 部署脚本
├── docker-compose.yml
└── package.json
```

## 环境要求

- Node.js >= 18
- 包管理：**pnpm >= 8（推荐）** 或 **npm >= 9**（内置 workspaces，无需单独安装 pnpm）
- Docker（用于本地 MySQL，可选）
- 原生 App 打包： [HBuilderX](https://www.dcloud.io/hbuilderx.html)（Android / iOS 云打包或真机调试）

## 命令速查

> 以下命令均在**项目根目录**执行。文档以 `pnpm` 为例；未安装 pnpm 时可将 `pnpm` 换为 `npm run`（如 `pnpm dev` → `npm run dev`）。组合启动：`pnpm dev:only <平台>` / `npm run dev:only -- <平台>`，平台标识见 [平台标识表](#平台标识表)。

### 环境与初始化

```bash
# 方式 A（推荐）：pnpm
npm install -g pnpm   # 若未安装
pnpm install

# 方式 B：仅使用 npm（无需安装 pnpm）
npm install

# 复制环境变量（首次）
cp .env.example .env

# 一键部署：MySQL → 迁移 → 种子数据 → 全量构建
pnpm bootstrap

# 一键部署并进入开发模式（自动 pnpm dev）
pnpm bootstrap:dev

# 跳过 Docker（本机已有 MySQL）
pnpm bootstrap --skip-docker
pnpm bootstrap:dev --skip-docker

# 手动只启动 MySQL（可选，bootstrap 已包含）
docker compose up -d mysql
```

### 数据库

```bash
pnpm db:setup      # 迁移 + 种子数据（等价 db:migrate && db:seed）
pnpm db:migrate    # 仅执行迁移
pnpm db:seed       # 仅初始化数据
pnpm db:reset      # 重置库并重新迁移、种子
```

### 开发运行（dev）

**一次启动全部（API + AI + Web 管理端 + PC 用户端 + H5 + 微信小程序 + Android App 热更新）：**

```bash
pnpm dev
pnpm env:status   # 可选：确认 API 指向本地
```

就绪后会**自动打开浏览器**：管理后台 `:5173`、PC 用户端 `:5176`；微信小程序编译完成后自动打开开发者工具。禁用：`DOUXING_NO_OPEN=1 pnpm dev`。

HBuilderX 导入 App 开发目录：`packages/mobile/dist/dev/app`（首次需「运行到手机」制作自定义调试基座）。

**只启动某一个或几个平台：**

```bash
pnpm dev:only server              # 仅后端 API
pnpm dev:only web                 # 仅 Web 管理端
pnpm dev:only mobile              # 仅移动端 H5
pnpm dev:only mp-weixin           # 仅微信小程序编译
pnpm dev:only app-android         # 仅 Android App（自动带上 server）
pnpm dev:only app-ios             # 仅 iOS App（自动带上 server）
pnpm dev:only server,web,mobile   # 任意组合，逗号分隔
pnpm dev:only server,pc           # 后端 + PC 用户端（浏览器自启 :5176）
```

**浏览器自启动（Vite 就绪后）：** 管理端 `dev:web`、PC 端 `dev:pc`；`pnpm dev` 全端时两者都会打开。环境变量见 [启动与部署流程 · §3.4](docs/启动与部署流程.md#34-浏览器自启动可选)。

**等价单平台命令（不自动组合其他端）：**

```bash
pnpm dev:server        # 后端 API       → http://localhost:3000
pnpm dev:web           # Web 管理端     → http://localhost:5173（就绪后自动打开浏览器）
pnpm dev:pc            # PC 用户端      → http://localhost:5176（就绪后自动打开浏览器）
pnpm dev:admin         # 后端 + 管理端   → API :3000 + 管理端 :5173
pnpm dev:mobile        # 移动端 H5      → http://localhost:5174
pnpm dev:mp-weixin     # 微信小程序     → packages/mobile/dist/dev/mp-weixin
pnpm dev:app           # 原生 App 开发
pnpm dev:app-android   # Android App 开发 → packages/mobile/dist/dev/app（Vite :5175）
pnpm dev:app-ios       # iOS App 开发（需 macOS + Xcode）
pnpm dev:ai-service    # Python AI 微服务（:8100，pnpm dev 已包含）
pnpm env:status        # 查看当前环境 API 与配置文件
```

### 构建（build）

**全量构建（所有子包）：**

```bash
pnpm build
```

**按平台单独构建：**

```bash
pnpm build:server        # 后端
pnpm build:web           # Web 管理端
pnpm build:mobile        # H5
pnpm build:mp-weixin     # 微信小程序
pnpm build:app           # 原生 App 资源
pnpm build:app-android   # Android App 资源
pnpm build:app-ios       # iOS App 资源
pnpm build:app-all       # Android + iOS 连续构建

# 任意组合
pnpm build:only server,web
pnpm build:only app-android,app-ios
```

**生产环境启动后端：**

```bash
pnpm build:server
pnpm --filter @douxing/server start
```

**生产环境公有化部署（腾讯云轻量 Debian 12 + HTTPS）：**

详见 [docs/deploy-production.md](docs/deploy-production.md) · 发版原理 [docs/发版流程与CI-CD解析.md](docs/发版流程与CI-CD解析.md)

```bash
# Debian 12 重装后（服务器上）
sudo bash scripts/setup-debian12.sh     # 环境初始化，完成后重新 SSH 登录
cp deploy/env.production.example .env  # 编辑域名、密码、密钥
pnpm deploy:server                     # Docker + 构建 + PM2
# Nginx + HTTPS 见 deploy-production.md 第 8 节

# 日常发版（配置 Webhook 后）：本地 push main 即可自动增量发版
git push origin main
# 手动发版：pnpm deploy:release -- --target=server,pc,web
```

### 原生 App（iOS / Android）一键部署

```bash
# 构建 Android + iOS 原生资源（产物目录见下表）
pnpm deploy:app

# 含数据库迁移、种子、依赖安装
pnpm deploy:app:full

# 构建后启动 API + 原生开发
pnpm deploy:app:dev

# 只构建某一端
pnpm deploy:app -- --platform android
pnpm deploy:app -- --platform ios
```

详细打包上架步骤：[scripts/app-native.md](scripts/app-native.md)

### 停止服务

```bash
pnpm stop          # 停止开发端口 + Docker MySQL
pnpm stop:dev      # 仅停止开发服务，保留 MySQL
pnpm stop:docker   # 仅停止 Docker MySQL
```

### 其他

```bash
pnpm preview:web   # 预览 Web 生产构建
pnpm lint          # 各包 TypeScript 检查（若配置）

# 修改 Drizzle schema 后生成迁移（在 server 包）
pnpm --filter @douxing/server db:generate

# 专属模型训练数据（I2，需 DEEPSEEK_API_KEY + MySQL）
pnpm ml:generate-dataset
pnpm ml:validate-dataset -- --split
pnpm ml:upload-dataset              # 上传 OSS + 生成 PAI manifest（需 OSS_ENABLED=true）
```

AI 路线生成（DeepSeek / LM Studio）环境变量与接口说明见下文 [AI 模型接入](#ai-模型接入-deepseek--lm-studio)。专属模型全流程见 [docs/阿里云-兜行专属模型训练与部署.md](docs/阿里云-兜行专属模型训练与部署.md)。

### 平台标识表

| 标识 | 说明 | 开发 | 默认端口 / 产物 |
|------|------|------|-----------------|
| `server` | 后端 API | `pnpm dev:server` | http://localhost:3000 |
| `web` | Web 管理端 | `pnpm dev:web` | http://localhost:5173（就绪后自动打开浏览器） |
| `pc` / `desktop` | PC 用户端 | `pnpm dev:pc` | http://localhost:5176（就绪后自动打开浏览器） |
| `mobile` / `h5` | 移动端 H5 | `pnpm dev:mobile` | http://localhost:5174 |
| `mp-weixin` / `mp` | 微信小程序 | `pnpm dev:mp-weixin` | `packages/mobile/dist/dev/mp-weixin`（编译后自动打开开发者工具） |
| `app-android` / `android` | Android App | `pnpm dev:app-android` | `packages/mobile/dist/build/app` |
| `app-ios` / `ios` | iOS App | `pnpm dev:app-ios` | `packages/mobile/dist/build/app` |
| `app` / `native` | 原生 App（通用） | `pnpm dev:app` | `packages/mobile/dist/build/app` |

### 启动后访问

| 端 | 地址 / 操作 |
|----|-------------|
| 管理端 | http://localhost:5173（`pnpm dev` / `dev:web` 就绪后自动打开） |
| PC 用户端 | http://localhost:5176（`pnpm dev` / `dev:pc` 就绪后自动打开） |
| 移动端 H5 | http://localhost:5174 |
| API 健康检查 | http://localhost:3000/api/health |
| 微信小程序 | [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) 导入 `packages/mobile/dist/dev/mp-weixin`；开发阶段关闭「校验合法域名」 |
| Android / iOS | `pnpm deploy:app` 后，HBuilderX 导入 `packages/mobile/dist/build/app` |

## 快速开始

```bash
npm install -g pnpm
cp .env.example .env
pnpm bootstrap:dev    # 初始化 + 启动全部开发服务
```

日常开发只需记住：`pnpm dev`（全端）或 `pnpm dev:only <平台>`（单端）。仅用 npm 时对应为 `npm run dev`、`npm run dev:only -- server,web`。

脚本通过 `scripts/pm.mjs` 自动识别当前包管理器；可用 `DOUXING_PM=npm` 或 `DOUXING_PM=pnpm` 强制指定。

## 默认账号

| 用户名 | 密码 | 说明 |
|--------|------|------|
| admin | admin123 | 管理员（Web 管理端） |
| demo | demo123 | 体验用户（移动端 / PC 用户端） |

## MVP 功能（基于详细设计文档 Sprint 1-2）

| 模块 | 功能 | 说明 |
|------|------|------|
| 用户 | 注册 / 登录 / **无感续期** | 双 Token（Access 15m + Refresh 30d）；`POST /api/auth/*`、`/api/auth/refresh`；详见 [docs/双Token认证与无感刷新.md](docs/双Token认证与无感刷新.md) |
| AI 规划 | 一句话生成路线 | **DeepSeek 云端** / **LM Studio 本地** 可选，`POST /api/routes/generate` |
| 路线 | 列表 / 详情 / 发布 / 解锁 | 解锁需模拟支付；**POI 信任链**（说明+评论筛选+UGC 视频 · H10-a/b/c） |
| 景点库 | 城市景点基础数据 | `GET /api/attractions`；AI 生成路线自动同步（pending + 合并）；管理员审核 |
| 打卡 | 景点打卡 | `POST /api/checkins`，支持 `attractionId`，自动触发成就；**打卡地图**（移动端 / Web / PC） |
| 成就 | 初行者 / 探索达人 / 路线大师 | 打卡后自动解锁 |
| 订单 | 路线解锁订单 + 模拟支付 | `POST /api/orders`、`POST /api/orders/:id/pay` |
| 旅程相册 | 按路线存旅行照 | `GET/POST /api/journey-albums`；EXIF 智能归类 · 相册分享 · 拍摄参数/同参数拼图；我的相册选路线上传；会员配额 `GET /api/users/me/storage`；打卡归并 · 手帐选图 |
| 移动端 | 首页 / 规划 / 路线 / 我的 | UniApp Tab 导航；路线详情相册 Tab；**AI 旅行宠物**悬浮层与记忆墙 |
| 管理端 | 路线 / 订单 / 打卡 / **数据分析** / **运营大屏** / 系统管理 | 需 admin；Leaflet 打卡地图；`/screen/travel` 旅行运营大屏；列表筛选与 XLSX 导出见 [Web管理端表格规范.md](docs/Web管理端表格规范.md) · [旅行运营大屏.md](docs/旅行运营大屏.md) · [PC双平台分工.md](docs/PC双平台分工.md) |
| PC 用户端 | 规划 / 路线 / 个人中心 / 相册 / 打卡地图 | `http://localhost:5176`；与移动端能力对齐；规划页 `PlanPetFocusCard` |

### AI 模型接入（DeepSeek / LM Studio）

路线生成支持三种模式（移动端「规划」页可切换）：

| 模式 | 说明 |
|------|------|
| `auto` | 优先兜行微调模型，失败再试 DeepSeek / LM Studio，最后模板 |
| `douxing` | 仅使用百炼专属微调模型（需 `DOUXING_LLM_*`） |
| `deepseek` | 仅使用 [DeepSeek API](https://platform.deepseek.com/) |
| `lmstudio` | 仅使用本地 [LM Studio](https://lmstudio.ai/) |

**DeepSeek（推荐云端）** — 在 `.env` 中配置（密钥勿提交 Git）：

```env
DEEPSEEK_API_KEY=你的密钥
DEEPSEEK_MODEL=deepseek-chat
LLM_DEFAULT_PROVIDER=auto
```

**LM Studio（本地）** — 启动 Local Server 后配置：

```env
LLM_BASE_URL=http://127.0.0.1:1234/v1
LLM_MODEL=你的模型名称
```

检测状态：`GET /api/routes/llm-status` · 可选列表：`GET /api/routes/llm-providers`  
生成时传参：`{ "prompt": "...", "provider": "deepseek" }`（`auto` | `deepseek` | `lmstudio`）

### MVP API 清单

> **完整接口文档**（120 个 REST 接口 + 参数说明）：见 [docs/API接口文档.md](./docs/API接口文档.md)  
> **Apifox 导入**：直接导入 [docs/openapi.yaml](./docs/openapi.yaml)（OpenAPI 3.0 · 103 路径 / 122 操作）  
> **系统管理接口**（`/api/system/*`）见 [docs/系统管理.md](./docs/系统管理.md)，未纳入 OpenAPI 主链

- `POST /api/auth/register` — 注册
- `GET /api/routes/llm-status` — 检测各模型是否可用
- `POST /api/routes/generate` — 生成路线（`provider` 可选）
- `GET /api/routes` — 路线列表（`scope=mine|plaza|favorites`、`status`、`sort`）；`?all=1` 管理员查看全部
- `GET /api/routes/plaza` — 广场公开路线（`is_public=1`）
- `GET /api/routes/hot` — 同广场（兼容旧路径）
- `GET /api/routes/:id` — 路线详情（自动 +1 浏览量）
- `PUT /api/routes/:id` — 编辑草稿（仅 `status=草稿`）
- `POST /api/routes/:id/like` — 点赞/取消点赞
- `POST /api/routes/:id/favorite` — 收藏/取消收藏
- `POST /api/routes/:id/share` — 公开/取消公开到广场（`{ "isPublic": true }`，需已发布）
- `GET /api/routes/:id/comments` — 评论列表（`dayIndex` / `attractionId` 筛选）
- `POST /api/routes/:id/comments` — 发表评论（可绑定 POI 上下文）
- `GET /api/routes/:routeId/media` — 路线/POI 视频列表（H10-b）
- `POST /api/routes/:routeId/media` — 上传短视频（≤60s）
- `POST /api/routes/:id/publish` — 发布路线
- `GET /api/attractions` — 景点列表（`city` / `cityCode` / `keyword` / `tags`）
- `GET /api/attractions/cities` — 有景点的城市汇总
- `GET /api/attractions/:id` — 景点详情（仅已发布）
- `GET /api/attractions/admin/pending` — 待审核景点（admin）
- `POST /api/attractions/admin/:id/approve` — 审核通过（admin）
- `POST /api/checkins` — 打卡（可传 `attractionId`）
- `GET /api/checkins` — 打卡列表
- `GET /api/achievements` — 已解锁成就（兼容）
- `GET /api/achievements/catalog` — 成就图鉴（含进度）
- `GET /api/achievements/mine` — 已解锁成就
- `GET /api/badges` — 徽章图鉴（含解锁状态与进度）
- `GET /api/badges/mine` — 已解锁徽章
- `GET /api/leaderboard` — 打卡排行榜（`period=week|month`、`metric=checkins|points`）
- `POST /api/orders` — 创建解锁订单
- `POST /api/orders/:id/pay` — 模拟支付
- `POST /api/pets/adopt` — 领养旅行伙伴（H3-a）
- `GET /api/pets/me` — 当前旅行伙伴
- `GET /api/pets/me/memories` — 记忆墙分页
- `POST /api/pets/me/analyze` — 宠物 AI 分析（`pre_plan` / `post_trip`）

## 数据库

- 表结构由 Drizzle 迁移管理：`packages/server/drizzle/`
- 常用命令见上文 [命令速查 · 数据库](#数据库)

### 1.3 核心实体（MySQL + Drizzle ORM）

| 表 | 说明 | 主要字段 |
|----|------|----------|
| `users` | 用户 | id、username、password_hash、phone、email、user_type、created_at、updated_at |
| `travel_routes` | 路线 | id、name、description、budget_range、days、interest_tags(JSON)、route_detail(JSON)、creator_id、status |
| `attractions` | 景点基础库 | id、name、city、city_code、latitude、longitude、tags(JSON)、ticket_price、aliases |
| `check_ins` | 打卡记录 | id、user_id、route_id、attraction_id、location(JSON)、checked_at、status、remark |
| `achievements` | 用户成就 | user_id、achievement_type、unlocked_at |
| `achievement_definitions` | 成就配置 | achievement_code、category、condition_type、condition_value |
| `badges` | 徽章定义 | badge_code、name、category、condition_type、condition_value、rarity |
| `user_badges` | 用户徽章 | user_id、badge_id、unlock_time、progress |

另有 RBAC 辅助表：`roles`、`user_roles`；系统配置：`system_config`。

状态与类型常量见 `@douxing/shared`（`UserType`、`RouteStatus`、`CheckInStatus`、`RoleCode`）。

## API 示例

- `GET /api/health` — 健康检查
- `POST /api/auth/login` — 登录（返回 `token` + `refreshToken` + `expiresIn`）
- `POST /api/auth/refresh` — 刷新 Access Token
- `POST /api/auth/logout` — 登出（吊销 Refresh Token）
- `GET /api/auth/me` — 当前用户（需 Bearer Access Token）

## 构建产物目录

| 端 | 开发 | 生产构建 |
|----|------|----------|
| Web | — | `packages/web/dist` |
| H5 | — | `packages/mobile/dist/build/h5` |
| 微信小程序 | `packages/mobile/dist/dev/mp-weixin` | `packages/mobile/dist/build/mp-weixin` |
| Android / iOS App | HBuilderX 真机调试 | `packages/mobile/dist/build/app` |

## 微信小程序

AppID：`wx2c8d1e2b2e502819`（已写入 `packages/mobile/src/manifest.json`）

常用命令见 [命令速查 · 开发运行](#开发运行dev) 与 [构建](#构建build)。

用 **微信开发者工具** 导入目录：

| 模式 | 目录 |
|------|------|
| 开发 | `packages/mobile/dist/dev/mp-weixin` |
| 发布 | `packages/mobile/dist/build/mp-weixin` |

开发阶段在开发者工具中关闭「校验合法域名」；本地 API 见 `.env.development`。

上线须在 [微信公众平台](https://mp.weixin.qq.com/) 配置 **request 合法域名**（HTTPS）。  
**生产 / 测试打包与环境变量** 详见 [docs/env-environments.md](docs/env-environments.md)。

```bash
pnpm build:mp-weixin:staging   # 测试 → api-test.yxtao.site
pnpm build:mp-weixin           # 生产 → api.yxtao.site
```

详细步骤见 [scripts/mp-weixin.md](scripts/mp-weixin.md)。

## 常见问题

### 已配置镜像加速器，仍无法访问 Docker Hub？

这是国内环境的常态，**不一定是你配置错了**。

#### 1. 加速器只管 `docker.io`，且很多已失效

`registry-mirrors` 只对 **`docker.io/library/xxx`** 这类短名镜像生效（例如 `mysql:8.0`）。

2024 年中以后，大量公共镜像站停服或不再同步 Docker Hub（中科大、网易、清华、阿里云**公共**地址等）。若仍填写已失效地址，Docker 会继续回退访问 `registry-1.docker.io`，表现就是超时。

**请确认配置已生效并重启 Docker Desktop：**

```bash
docker info | grep -A 10 "Registry Mirrors"
```

Windows：Settings → Docker Engine 改 JSON 后点 **Apply & Restart**（只改文件不重启无效）。

2026 年仍可尝试的镜像加速（建议写 2～3 个，任选）：

```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://docker.m.daocloud.io"
  ]
}
```

阿里云需登录控制台获取**个人专属**加速地址，公共的 `https://registry.cn-hangzhou.aliyuncs.com` **不能**当通用 Docker Hub 镜像。

#### 2. 本项目默认不用 Docker Hub 短名

`docker-compose.yml` 默认镜像为：

```text
docker.m.daocloud.io/library/mysql:8.0
```

这是**第三方仓库地址**，不走 `registry-mirrors` 对 `docker.io` 的加速逻辑。若仍失败，说明 **DaoCloud 这条线路**也访问不了，与「Docker Hub 加速器」无关。

可在 `.env` 中换成其他可拉取的完整地址后重试：

```env
# 任选其一，先手动测试: docker pull <下面完整地址>
MYSQL_IMAGE=docker.1ms.run/library/mysql:8.0
# MYSQL_IMAGE=docker.xuanyuan.me/library/mysql:8.0
# MYSQL_IMAGE=mysql:8.0
```

```bash
docker pull docker.1ms.run/library/mysql:8.0
docker compose up -d mysql
```

#### 3. 端口 3306 被占用（`bind: Only one usage...`）

说明**本机已有 MySQL 占用了 3306**（很常见）。Docker 不能再监听同一端口。

**推荐：** 继续用本机 MySQL，跳过 Docker：

```bash
pnpm bootstrap --skip-docker
```

**若坚持用 Docker MySQL：** 项目已把容器默认映射到宿主机 **3307**（见 `DOCKER_MYSQL_HOST_PORT`），并相应修改 `.env`：

```env
DOCKER_MYSQL_HOST_PORT=3307
DATABASE_URL=mysql://douxing:douxing123@localhost:3307/douxing
```

不要同时让本机 MySQL 和 Docker MySQL 都占 3306。

#### 4. 你当前更适合跳过 Docker

本机 MySQL 已可用（`root` / `123456`）时，**不必再拉镜像**：

```bash
pnpm bootstrap --skip-docker
```

#### 5. 仍要直连 Docker Hub 时

- 为 Docker Desktop 配置系统/HTTP 代理（VPN 需允许 Docker 走代理）
- 或在外网环境执行 `docker pull mysql:8.0` 后导出镜像再导入内网



# monorepo
Monorepo 的意思是：**一个 Git 仓库里放多个可独立开发的子项目（包）**，用统一工具链管理依赖、构建和脚本。在「兜行」里主要体现在下面几处。

包管理器说明（pnpm 推荐、npm 可选）见 [docs/包管理与命令.md](docs/包管理与命令.md)。

## 1. 工作区定义（Workspace）

**pnpm**：根目录 `pnpm-workspace.yaml`：

```yaml
packages:
  - 'packages/*'
```

**npm**：根目录 `package.json` 中 `"workspaces": ["packages/*"]`。

`packages/` 下每个子目录都是一个 **package**。团队以 **`pnpm-lock.yaml`** 为主锁；`.npmrc` 中 `shamefully-hoist`（pnpm）与 `install-strategy=hoisted`（npm）用于提升依赖，便于 UniApp/Vite 解析。

---

## 2. 多包并列、职责拆分

```
project/                    ← 根包（douxing），只做编排，不写业务
├── packages/
│   ├── web/                ← @douxing/web     管理端
│   ├── pc/                 ← @douxing/pc      PC 用户端
│   ├── mobile/             ← @douxing/mobile  移动端
│   ├── server/             ← @douxing/server  后端
│   ├── shared/             ← @douxing/shared  跨端共享
│   ├── ai-service/         ← @douxing/ai      Python AI 微服务
│   └── ml-training/        ← @douxing/ml      专属模型训练数据
├── scripts/                ← 全仓库级脚本（bootstrap）
├── docker-compose.yml      ← 全仓库级基础设施
└── .env                    ← 全仓库级环境变量
```

这是 monorepo 最核心的结构：**多应用 + 共享库，同仓维护**。

---

## 3. 包之间用 workspace 协议依赖

子包不通过 npm 发包，而是直接引用本地包：

```json
"@douxing/shared": "workspace:*"
```

出现在 `web`、`mobile`、`server` 的 `package.json` 里。改 `shared` 里的类型/常量，三端立刻生效，无需先 `npm publish`。

例如三端共用：

- `APP_NAME`、`API_PREFIX`、`RoleCode`（`packages/shared`）
- `ApiResponse`、`UserInfo`、`LoginResult` 等 TypeScript 类型

---

## 4. 根目录统一编排（Filter / Recursive）

根 `package.json` 不实现业务，只**调度子包**（内部经 `scripts/pm.mjs` 转发，兼容 pnpm / npm）：

| 能力 | 命令（pnpm） | 底层机制 |
|------|--------------|----------|
| 只跑后端 | `pnpm dev:server` | filter `@douxing/shared` build + `@douxing/server` dev |
| 只构建 Web | `pnpm build:web` | filter `@douxing/web` |
| 构建全部 | `pnpm build` | 各 workspace recursive build |
| 同时开发三端 | `pnpm dev` | concurrently + 多子包 dev |

npm 等价写法见 [包管理与命令.md](docs/包管理与命令.md#3-命令写法对照)。

`@douxing/*` 是 **scope 命名**，便于在仓库里精确指定「跑哪一个包」。

---

## 5. 一次安装、统一版本

在项目根执行一次：

```bash
pnpm install
```

会为 **所有子包** 解析依赖并写入 **同一份锁文件**（pnpm：`pnpm-lock.yaml`），避免 web 用 Vue 3.5、mobile 用 3.4 却互不知情的问题。

---

## 6. 共享配置与脚本在根目录

这些不属于某个子应用，而是**整仓级别**：

- `.env` / `docker-compose.yml` — 数据库、部署（后端密钥，**勿写 VITE_***）
- `.env.local` — 本机 dev API 地址、微信 CLI（gitignore）
- `scripts/deploy.mjs` — 一键 bootstrap
- `scripts/README.md` — 各脚本用途说明
- `README.md` — 全项目说明

子包只关心自己的 `vite.config.ts`、`drizzle` 等；**跨包流程**放在根目录，这也是 monorepo 常见做法。

---

## 和「多仓库」的对比（帮助理解）

| | Monorepo（当前） | Multirepo（多仓库） |
|--|------------------|---------------------|
| 代码位置 | 一个 Git 仓库 | web / mobile / server 各一个仓库 |
| 改 shared 类型 | 改一处，三端同步 | 要发 npm 包或复制粘贴 |
| 安装依赖 | 根目录 `pnpm install` / `npm install` 一次 | 每个仓库各装一遍 |
| 版本/发布 | 可统一发版（未做也可分开发） | 各自独立 |

---

## 当前项目里「还不是」典型 monorepo 的部分

为了脚手架简单，没有引入 Turborepo、Changesets、统一 ESLint 等；**可按需选型**，完整说明与落地顺序见 **[docs/外部工具与插件推荐.md](./docs/外部工具与插件推荐.md)**。

**现有结构已经是标准的 workspace monorepo**（pnpm + npm 双支持）。

---

**一句话：** monorepo 体现在「一个仓库、`packages/*` 多子包、`workspace:*` 共享 `@douxing/shared`、根目录统一 dev/build/db」。不是把三个项目硬塞在一个文件夹里，而是用 workspace 把它们连成可协作的整体。
