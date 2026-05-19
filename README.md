# 兜行 (Douxing)

多端出行服务平台 Monorepo 脚手架。

## 技术栈

| 模块 | 技术 |
|------|------|
| 包管理 | pnpm workspace |
| Web 管理端 | Vue 3 + Vite + Pinia + Vue Router |
| 移动端 | UniApp (Vue 3) + Vite（H5 / 微信小程序） |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MySQL 8 + Drizzle ORM |
| 共享 | `@douxing/shared` 类型与常量 |

## 目录结构

```
project/
├── packages/
│   ├── web/      # Vue3 Web 管理端
│   ├── mobile/   # UniApp 移动端
│   ├── server/   # Node 后端 API
│   └── shared/   # 跨端共享类型
├── scripts/      # 部署脚本
├── docker-compose.yml
└── package.json
```

## 环境要求

- Node.js >= 18
- pnpm >= 8
- Docker（用于本地 MySQL，可选）

## 快速开始

### 一键部署（推荐）

```bash
# 安装 pnpm（若未安装）
npm install -g pnpm

# 一键：启动 MySQL → 安装依赖 → 迁移表结构 → 初始化数据 → 构建（含微信小程序）
pnpm bootstrap

# 开发模式（部署后自动启动全部 dev 服务，含微信小程序编译监听）
pnpm bootstrap:dev

# ⚠️ bootstrap 只构建，不启动页面。部署完成后必须执行：
pnpm dev   # 含 API、管理端、H5、微信小程序（mp-weixin 监听编译）

# 一键停止所有服务（开发端口 + Docker MySQL）
pnpm stop

# 仅停止开发服务，保留 Docker / 本机 MySQL
pnpm stop:dev
```

启动后访问：

| 端 | 地址 / 操作 |
|----|-------------|
| 管理端 | http://localhost:5173 |
| 移动端 H5 | http://localhost:5174 |
| API | http://localhost:3000/api/health |
| 微信小程序 | 用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)导入 `packages/mobile/dist/dev/mp-weixin`（`pnpm dev` 会自动编译）；开发阶段关闭「校验合法域名」 |

Windows PowerShell:

```powershell
.\scripts\deploy.ps1
.\scripts\deploy.ps1 --dev
```

### 手动启动

```bash
cp .env.example .env
docker compose up -d mysql
pnpm install
pnpm db:setup          # 建表 + 种子数据
pnpm dev:server        # API :3000
pnpm dev:web           # Web :5173
pnpm dev:mobile        # H5  :5174
pnpm dev:mp-weixin     # 微信小程序编译 → dist/dev/mp-weixin
# 或 pnpm dev 一次启动以上全部（含小程序）
```

## 默认账号

| 用户名 | 密码 |
|--------|------|
| admin | admin123 |

## 数据库

- 表结构由 Drizzle 迁移管理：`packages/server/drizzle/`
- 修改 schema 后生成迁移：`pnpm --filter @douxing/server db:generate`
- 执行迁移：`pnpm db:migrate`
- 初始化数据：`pnpm db:seed`

### 1.3 核心实体（MySQL + Drizzle ORM）

| 表 | 说明 | 主要字段 |
|----|------|----------|
| `users` | 用户 | id、username、password_hash、phone、email、user_type、created_at、updated_at |
| `travel_routes` | 路线 | id、name、description、budget_range、days、interest_tags(JSON)、route_detail(JSON)、creator_id、status |
| `check_ins` | 打卡记录 | id、user_id、route_id、location(JSON)、checked_at、status、remark |
| `achievements` | 成就 | id、user_id、achievement_type、unlocked_at、description |

另有 RBAC 辅助表：`roles`、`user_roles`；系统配置：`system_config`。

状态与类型常量见 `@douxing/shared`（`UserType`、`RouteStatus`、`CheckInStatus`、`RoleCode`）。

## API 示例

- `GET /api/health` — 健康检查
- `POST /api/auth/login` — 登录
- `GET /api/auth/me` — 当前用户（需 Bearer Token）

## 生产构建

```bash
pnpm build
pnpm --filter @douxing/server start
```

Web 静态资源输出在 `packages/web/dist`，可交由 Nginx 托管；移动端 H5 输出在 `packages/mobile/dist/build/h5`；微信小程序输出在 `packages/mobile/dist/build/mp-weixin`（`pnpm build` 已包含）。

## 微信小程序

AppID：`wx8bdbe398733ca0f0`（已写入 `packages/mobile/src/manifest.json`）

```bash
pnpm dev:server          # 先启动 API
pnpm dev:mp-weixin       # 编译小程序（开发模式）

pnpm build:mp-weixin     # 生产构建 → dist/build/mp-weixin
```

用 **微信开发者工具** 导入目录：

| 模式 | 目录 |
|------|------|
| 开发 | `packages/mobile/dist/dev/mp-weixin` |
| 发布 | `packages/mobile/dist/build/mp-weixin` |

开发阶段在开发者工具中关闭「校验合法域名」；`.env` 中：

```env
VITE_API_BASE_URL=http://127.0.0.1:3000/api
```

上线须在 [微信公众平台](https://mp.weixin.qq.com/) 配置 **request 合法域名**（HTTPS），并修改 `VITE_API_BASE_URL` 为生产 API 地址。

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

## 1. 工作区定义（Workspace）

根目录的 `pnpm-workspace.yaml` 声明哪些目录是子包：

```1:2:e:\Desktop\兜行项目\project\pnpm-workspace.yaml
package
  - 'packages/*'
```

`packages/` 下每个子目录都是一个 **package**，共享同一份 `pnpm-lock.yaml` 和根目录 `node_modules` 链接策略（`.npmrc` 里的 `shamefully-hoist`）。

---

## 2. 多包并列、职责拆分

```
project/                    ← 根包（douxing），只做编排，不写业务
├── packages/
│   ├── web/                ← @douxing/web     管理端
│   ├── mobile/             ← @douxing/mobile  移动端
│   ├── server/             ← @douxing/server  后端
│   └── shared/             ← @douxing/shared  跨端共享
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

根 `package.json` 不实现业务，只**调度子包**：

| 能力 | 命令 | Monorepo 机制 |
|------|------|----------------|
| 只跑后端 | `pnpm dev:server` | `pnpm --filter @douxing/server` |
| 只构建 Web | `pnpm build:web` | `--filter @douxing/web` |
| 构建全部 | `pnpm build` | `pnpm run -r build`（recursive） |
| 同时开发三端 | `pnpm dev` | 根脚本 + 分别 filter 各包 |

`@douxing/*` 是 **scope 命名**，便于在仓库里精确指定「跑哪一个包」。

---

## 5. 一次安装、统一版本

在项目根执行一次：

```bash
pnpm install
```

会为 **所有子包** 解析依赖并写入 **同一份** `pnpm-lock.yaml`，避免 web 用 Vue 3.5、mobile 用 3.4 却互不知情的问题（pnpm 会尽量提升/对齐兼容版本）。

---

## 6. 共享配置与脚本在根目录

这些不属于某个子应用，而是**整仓级别**：

- `.env` / `docker-compose.yml` — 数据库、部署
- `scripts/deploy.mjs` — 一键 bootstrap
- `README.md` — 全项目说明

子包只关心自己的 `vite.config.ts`、`drizzle` 等；**跨包流程**放在根目录，这也是 monorepo 常见做法。

---

## 和「多仓库」的对比（帮助理解）

| | Monorepo（当前） | Multirepo（多仓库） |
|--|------------------|---------------------|
| 代码位置 | 一个 Git 仓库 | web / mobile / server 各一个仓库 |
| 改 shared 类型 | 改一处，三端同步 | 要发 npm 包或复制粘贴 |
| 安装依赖 | 根目录 `pnpm install` 一次 | 每个仓库各装一遍 |
| 版本/发布 | 可统一发版（未做也可分开发） | 各自独立 |

---

## 当前项目里「还不是」典型 monorepo 的部分

为了脚手架简单，没有引入：

- **Turborepo / Nx** — 构建缓存、任务依赖图
- **Changesets** — 多包版本发布与 changelog
- **统一 ESLint/Prettier 根配置包** — 可再加 `packages/eslint-config`

这些可以后续按需加；**现有结构已经是标准的 pnpm workspace monorepo**。

---

**一句话：** monorepo 体现在「一个仓库、`packages/*` 多子包、`workspace:*` 共享 `@douxing/shared`、根目录用 pnpm filter/recursive 统一 dev/build/db」。不是把三个项目硬塞在一个文件夹里，而是用 pnpm workspace 把它们连成可协作的整体。
