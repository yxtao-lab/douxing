# PC 双平台分工（用户端 vs 管理端）

> **定位**：明确 `packages/pc`（PC 用户端）与 `packages/web`（Web 管理端）的功能边界、共用能力与展示差异。  
> **关联**：移动端 C 端能力对齐见 [ROADMAP · 阶段 P](./ROADMAP.md#阶段-pc-用户端c-端桌面网页2026-06-08-录入)；管理端 RBAC 见 [系统管理.md](./系统管理.md)；**双 Token 鉴权**见 [双Token认证与无感刷新.md](./双Token认证与无感刷新.md)。

**最后更新：** 2026-07-16（**强制：PC 仅 C 端 · B 端一律 Web** · M7 `/partner` · H10 Web 视频审核 · E2 接线 · 双 Token · C7-W · S1/S2 · DT5）

---

## 0. 端侧铁律（必读）

> **PC 用户端（`packages/pc`）只针对 C 端用户；所有 B 端操作都放到 Web（`packages/web`）。**  
> Agent 规则：`.cursor/rules/pc-c-web-b-split.mdc`（始终生效）

| 端 | 包 | 角色 | 做什么 |
|----|-----|------|--------|
| **PC 用户端** | `packages/pc` | **仅 C 端** | 旅行自助 + **发单方**（定制服务大厅 / 发单 / 团体等） |
| **Web** | `packages/web` | **全部 B 端** + 平台运营 | 管理后台；**商户工作台** `/partner`（入驻、接单、报价、履约） |
| **移动端** | `packages/mobile` | C 端为主 | 与 PC 对齐的 C 端；可有轻量引导，**完整 B 端闭环以 Web `/partner` 为准** |

**禁止**：在 PC 做商户入驻/接单/报价/卖方履约；在 Web 商户台做「我的团体」等纯发单方能力（团体属 C 端，落 mobile/PC）。

---

## 1. 总体定位

| 维度 | PC 用户端 `@douxing/pc` | Web 管理端 `@douxing/web` |
|------|-------------------------|---------------------------|
| 开发端口 | `http://localhost:5176` | `http://localhost:5173` |
| 面向角色 | **仅 C 端普通用户**（旅行自助 + 发单方） | **平台运营 / 管理员 / 商户（B 端）** |
| 默认体验账号 | `demo` / 注册用户 | `admin`（须 `admin` 角色）；商户 `merchant`（`/login?portal=partner`） |
| UI 体系 | Tailwind + 紫青 C 端品牌 | Ant Design Vue 4 + 青蓝橙管理品牌 |
| 布局 | 顶栏导航 + 内容区 | 侧栏 + 多标签页工作台 |
| 核心目标 | 规划 → 路线 → 打卡 → 分享（**用产品**） | 审核 → 配置 → 监控 → 分析（**管平台**） |
| 路由入口 | `packages/pc/src/router/index.ts` | `packages/web/src/router/index.ts` |

### 1.1 与移动端的关系

PC 用户端是 **桌面版 C 端**，不是第三套业务逻辑：

- 与移动端共用 `@douxing/shared` 类型与大部分 REST API
- **能力对齐、布局独立**：大屏规划双栏、路线详情、手帐 PNG 下载等
- 移动端独有：语音输入、小程序登录、部分原生能力
- PC 独有（规划/已定稿）：手帐浏览器下载、**F 线 3D/孪生**（mobile 不做 3D）

### 1.3 鉴权（双 Token，2026-07-07）

Web 与 PC **共用**同一套后端会话与本地存储键（`douxing_token` · `douxing_refresh_token` · `douxing_user`），详见 [双Token认证与无感刷新.md](./双Token认证与无感刷新.md)。

| 端 | 拦截实现 | 会话恢复 |
|----|----------|----------|
| **Web 管理端** | `api/http.ts` axios 拦截器 | 路由守卫 `ensureSessionBootstrapped()` + 员工/菜单校验 |
| **PC 用户端** | 同 Web | `bootstrapSession` + 路由 `requiresAuth` |

差异：**Web** 登出后须 `admin` 角色才能进工作台；**PC** 为普通用户 JWT。两端 Access 过期时均由拦截器 **无感 refresh**，无需用户重新输入密码（Refresh 未过期前提下）。

### 1.2 架构关系

```text
移动端 (H5/小程序/App) ──┐
PC 用户端 (:5176)      ──┼──► server API ──► MySQL
Web 管理端 (:5173)     ──┘
```

管理端 **不替代** 移动端或 PC 的任何 C 端流程。模块 B **商户接单**为 Web 第四入口 **`/partner`（M7-α）**，与平台运营共用 `BasicLayout`、独立 `merchant` 角色菜单，见 [发单接单平台 §6.2](./发单接单平台.md#62-商户端--服务者端)。

---

## 2. 仅用户端（PC）的功能

属于 **「我的旅行」** 自助能力；管理端不提供同类创作/消费流程。

| 模块 | 路由 | 状态 | 说明 |
|------|------|------|------|
| 首页营销 | `/` | ✅ | Hero、标语、快捷入口、广场热门路线 |
| AI 智能规划 | `/plan` | ✅ | 双栏对话、多方案候选、追问、LLM 选择、取消规划 |
| 路线列表 | `/routes` | ✅ | 我的 / 广场 / 收藏 Tab；状态筛选 |
| 路线详情 | `/routes/:id` | ✅ | 流程图、地图动画、草稿编辑、发布/公开、互动 · **POI 信任链（说明/评论/视频）** · **路线/POI 短视频上传播放**（H10-a/b/c） |
| 个人中心 | `/profile` | ✅ | 入口聚合：成就、徽章、打卡、订单等 |
| 资料编辑 | `/profile/edit` | ✅ | 头像、兴趣标签等（`GET/PATCH /api/users/me`） |
| 会员权益 | `/profile/membership` | ✅ | 会员等级与权益说明 |
| 旅程相册列表 | `/journey-albums` | ✅ | 相册卡片 · 创建/删除 · 存储用量 |
| 旅程相册详情 | `/journey-albums/:albumId` | ✅ | 本册照片上传/删除/预览 · 跳转关联路线 |
| 成就 | `/achievements` | ✅ | 个人成就列表与解锁状态 |
| 徽章 | `/badges` | ✅ | 徽章进度 |
| 排行榜 | `/leaderboard` | ✅ | 周榜/月榜参与视图 |
| 我的打卡 | `/checkins` | ✅ | 仅本人打卡记录 |
| 我的打卡地图 | `/checkins/map` | ✅ | Leaflet + 高德；**个人足迹** |
| 我的订单 | `/orders` | ✅ | 本人订单；待支付可 **继续支付** |
| 分享与手帐 | `/share/routes/:id` | ✅ | 路线只读分享页；Canvas 手帐 **下载 PNG** |
| 旅程相册分享 | `/share/journey-albums/:token` | ✅ | 相册 token 只读 H5（J5） |
| 登录 | `/login` | ✅ | 密码/短信；双 Token（Access + Refresh） |

### 2.1 规划中的用户端专属

| 模块 | 说明 | 文档 |
|------|------|------|
| **F 线 3D / 孪生** | 路线 3D 预览、足迹孪生、景点模型播放；**仅 pc** | [数字孪生与三维建模.md](./数字孪生与三维建模.md) |
| **模块 B 发单（C 端）** | 「定制服务」大厅 / 发单 / 我的需求 / **我的团体** | [发单接单平台.md §6.1](./发单接单平台.md#61-c-端--pc) |
| **模块 B 商户（B 端）** | **不在 PC**；一律 Web `/partner` | [发单接单平台.md §6.2](./发单接单平台.md#62-商户端--服务者端) · [PC双平台分工 §0](#0-端侧铁律必读) |
| **P5 生产部署** | `www` / `pc` 子域、Nginx 静态资源 | [ROADMAP · P5](./ROADMAP.md#阶段-pc-用户端c-端桌面网页2026-06-08-录入) |

---

## 3. 仅管理端（Web）的功能

属于 **平台运营与内部运维**；C 端用户不应接触。

### 3.1 业务与内容运营

| 模块 | 路由 | 状态 | 说明 |
|------|------|------|------|
| 工作台 | `/` | ✅ | 全站统计卡片、快捷入口（**运营视角**，非 C 端首页） |
| 全平台路线 | `/routes` | ✅ | 全站路线 **只读表格** 审计 |
| 全平台订单 | `/orders` | ✅ | 全站订单表格；无支付操作 |
| 全平台打卡 | `/checkins` | ✅ | 全用户打卡列表 |
| 全平台打卡地图 | `/checkins/map` | ✅ | **全平台足迹**；Leaflet + 侧栏筛选 |
| 景点待审核 | `/attractions/pending` | ✅ | AI 同步景点审核通过 |
| **路线视频审核** | `/attractions/media/pending` | ✅ | H10 UGC 短视频待审 · 预览通过/拒绝 |
| 景点库管理 | `/attractions/manage` | ✅ | 目录维护、封面上传、高德封面刷新 |
| 动线 Playbook | `/playbooks/manage` | ✅ | 经典动线 CRUD、`classicOrder`、段间边 |
| 数据分析 | `/analytics` | ✅ | 概览、30 日趋势、城市 Top10（DT1） |
| **规划诊断** | `/plan-sessions/diagnostics/:sessionId?` | ✅ | NodeSpan 时间线 · 费用汇总 · Langfuse 深链（C7-W W2） |
| **工作流模板** | `/workflow-templates` | ✅ | 模板 CRUD · JSON Logic · RAG 参数（C7-W W3） |
| **可视化编排** | `/workflow-templates/:id/editor` | ✅ | Vue Flow DAG 编辑 · 沙箱预览 · SSE 画布执行态（C7-W W5） |

### 3.2 系统管理（S 线）

| 模块 | 路由 | 状态 |
|------|------|------|
| 用户管理 | `/system/users` | ✅ |
| 角色管理 | `/system/roles` | ✅ |
| 菜单管理 | `/system/menus` | ✅ |
| 部门管理 | `/system/depts` | ✅ |
| 岗位管理 | `/system/posts` | ✅ |
| 字典管理 | `/system/dict` | ✅ |
| 参数配置 | `/system/config` | ✅ |
| 通知公告 | `/system/notices` | ✅ |

详见 [系统管理.md](./系统管理.md)。`sys_dept` 为 **平台内部 HR**，商户组织走模块 B 的 `biz_org`，二者不混用。

### 3.3 监控与日志

| 模块 | 路由 | 状态 |
|------|------|------|
| 在线用户 | `/monitor/online` | ✅ |
| 定时任务 | `/monitor/jobs` | ✅ |
| 数据监控 | `/monitor/data` | ✅ |
| 服务监控 | `/monitor/server` | ✅ |
| 缓存监控 | `/monitor/cache`、`/monitor/cache-list` | ✅ |
| 操作日志 | `/log/oper` | ✅ |
| 登录日志 | `/log/login` | ✅ |

### 3.4 发单接单（M 线 · 模块 B）

**平台监管（admin/operator）**：

| 模块 | 路由 | 状态 | 说明 |
|------|------|------|------|
| 入驻审核 | `/marketplace/orgs/pending` | ✅ | 商户 org 审核 |
| 服务者审核 | `/marketplace/providers/pending` | ✅ | 个人 provider 认证审核 |
| 需求监管 | `/marketplace/demands` | ✅ | 全站需求单列表 + 筛选 + 导出 |

**商户工作台（M7-α · `merchant` 角色）**：

| 模块 | 路由 | 状态 | 说明 |
|------|------|------|------|
| 商户首页 | `/partner` | ✅ | 入驻状态、快捷入口 |
| 入驻与认证 | `/partner/onboard` | ✅ | `?panel=org\|provider` 单页切换 |
| 接单大厅 | `/partner/demands` | ✅ | 需求列表 + 报价入口 |
| 我的报价 | `/partner/quotes` | ✅ | 报价记录 |
| 我的订单 | `/partner/orders` | ✅ | 卖方履约推进 · 汇报时间线 |
| 行程排期 | `/partner/schedule` | ✅ | 领队指派 · 行程日历（M7-3） |
| 财务结算 | `/partner/settlements` | ✅ | 结算台账列表（M7-5） |

登录：`/login?portal=partner` · 演示账号 `merchant` / `merchant123`（`db:seed-merchant`）

### 3.5 规划中的管理端专属

| 模块 | 说明 | 文档 |
|------|------|------|
| **DT5 旅行运营大屏** | — | 全屏 `/screen/travel`；全国分布 + 用户路径漏斗 + 热力图层 | [旅行运营大屏.md](./旅行运营大屏.md) |
| **F2 3D 资产审核** | glTF/GLB 入库、绑定景点；用户在 pc 播放 | [数字孪生与三维建模.md](./数字孪生与三维建模.md) |
| **沙箱真机支付** | 商户号就绪后联调一笔，收口完整 MB4 | [发单接单路线图 §0](./发单接单路线图.md#0-当前指针必读) · [后期待办.md](./后期待办.md) |
| **S1/S2 RBAC** | `requirePerm` · 动态侧栏 · 数据权限（远期） | [系统管理.md](./系统管理.md)（**S0～S2 已验收**） |

---

## 4. 两端共有、展示与权限不同

同一业务域，通常 **API 不同**（个人接口 vs 管理员分页接口），UI 形态也不同。

| 功能 | 用户端 PC | 管理端 Web |
|------|-----------|------------|
| **路线** | 卡片流 + Tab（我的/广场/收藏）；可 **编辑、发布、互动** | `DouxingAdminTable` 全站分页；**只读审计**；支持筛选与 **XLSX 导出** |
| **订单** | **仅我的**；卡片列表；待支付可 **发起支付** | **全平台**表格；纯监管，无支付按钮；**XLSX 导出** |
| **打卡列表** | **仅本人**记录 | **全用户**列表，运营排查；空值 `-` 占位 |
| **打卡地图** | 个人足迹；时间/城市筛选；全国 `fitBounds` | 全平台足迹；侧栏筛选；运营看分布 |
| **登录** | 普通用户；未登录可浏览首页部分能力 | 须员工角色进工作台；商户走 `portal=partner` + `merchant` 角色 |
| **首页** | 品牌宣传 + 引导规划 | 数据统计 + 运营快捷入口 |

### 4.1 典型 API 差异（示例）

| 场景 | 用户端 | 管理端 |
|------|--------|--------|
| 路线列表 | `GET /api/routes`（scope: mine/square 等） | 管理员分页接口 / 全量审计 |
| 订单 | `GET /api/orders`（本人） | 管理员订单分页 |
| 打卡 | `GET /api/checkins`（本人） | 管理员全站打卡 |
| 景点 | `GET /api/attractions`（已审核库） | `GET /api/attractions/admin/*`（待审/目录/封面） |

完整接口见 [API接口文档.md](./API接口文档.md)。

### 4.2 打卡地图（B3+）

两端均使用 Leaflet + 高德双层瓦片，但数据范围与交互目标不同：

- **PC**：从个人中心 / 打卡列表进入；强调「我的足迹」叙事
- **Web**：侧栏业务菜单；强调全平台分布与运营筛选

实现记录见 [开发记录 · B3+](./开发记录-重难点与亮点.md#b3-webpc-leaflet-打卡地图)。

---

## 5. 分工判断原则（新功能放哪端）

```text
用户端（pc + mobile · C 端）：我能做什么、我的数据、创作与分享、支付与会员、发单方（需求/团体）
管理端 / 商户端（web · B 端）：全站怎么审怎么配；商户怎么入驻/接单/报价/履约
```

| 判断问题 | 放用户端（pc / mobile） | 放 Web |
|----------|------------------------|--------|
| 数据范围 | 「我的」或「广场公开」 | 「全平台 / 全用户」或「本商户 org」 |
| 操作性质 | 创作、消费、社交、支付、**发单** | 审核、启停、配置、监控、**接单/报价/履约** |
| 角色 | 注册用户 / 发单方 | `admin` · `merchant` · 细粒度 `perms` |
| 沉浸体验 / 3D | pc 用户浏览（F 线） | web 资产审核 + DT5 大屏 |
| 商户组织 | **禁止**在 PC 做 B 端工作台 | 入驻审核、`/partner`、订单监管（M 线） |

**禁止**：在管理端复刻 C 端规划/手帐创作流程；在 C 端（尤其 **PC**）暴露全站用户启停、系统参数、**商户接单工作台**等运营/B 端能力。

### 5.1 新页面 UI 与组件（2026-07-10）

| 端 | 页面壳 | 风格 Token | 主题 / i18n |
|----|--------|------------|-------------|
| PC 用户端 | `SubPageShell` | Tailwind `text-dx-*` / `bg-dx-*`（`tailwind.config.js`） | `usePageTitle` · 文案 `packages/pc/src/i18n` |
| Web 管理端 | `PageContainer admin` | Ant Design 主题 + `main.css` Token | 顶栏语言切换 · shared `web.*` |
| 移动端（对照） | `page` + `themeClass` | `--dx-*`（`theme.css`） | `useTheme()` · `useTf()` |

- 新增页面须对齐同端已有页面，**禁止**自造表格/筛选/空状态等已有通用能力
- 跨端重复 UI 优先封装组件；细则见 [Cursor-Agent规则.md](./Cursor-Agent规则.md) · [品牌视觉规范.md](./品牌视觉规范.md)

---

## 6. 路由对照速查

| 路径 | PC 用户端 | Web 管理端 |
|------|-----------|------------|
| `/` | C 端首页 | 运营工作台 |
| `/plan` | ✅ AI 规划 | — |
| `/routes` | ✅ 我的/广场路线 | ✅ 全站路线表 |
| `/routes/:id` | ✅ 详情与编辑 | — |
| `/profile` 及子页 | ✅ 个人中心生态 | — |
| `/checkins` | ✅ 我的打卡 | ✅ 全站打卡 |
| `/checkins/map` | ✅ 个人地图 | ✅ 全站地图 |
| `/orders` | ✅ 我的订单+支付 | ✅ 全站订单 |
| `/share/routes/:id` | ✅ 路线分享页 | — |
| `/share/journey-albums/:token` | ✅ 相册分享页 | — |
| `/journey-albums` | ✅ 我的相册列表 | — |
| `/journey-albums/:albumId` | ✅ 相册详情 + 上传 | — |
| `/attractions/*` | — | ✅ 审核与管理 |
| `/playbooks/manage` | — | ✅ |
| `/analytics` | — | ✅ |
| `/system/*` | — | ✅ |
| `/monitor/*` | — | ✅ |
| `/log/api` | — | ✅ 接口日志（2026-07-01） |
| `/screen/travel` | — | ✅ DT5 运营大屏 |

---

## 7. 相关文档

| 文档 | 用途 |
|------|------|
| [Cursor-Agent规则.md](./Cursor-Agent规则.md) | `.cursor/rules` 索引 · 新页面 UI / i18n / 组件复用 |
| [项目概述.md](./项目概述.md) | Monorepo 结构、模块 A/B 主链 |
| [品牌视觉规范.md §14～15](./品牌视觉规范.md) | 管理端 vs PC 用户端 Logo 与色板 |
| [国际化.md](./国际化.md) | 新增功能须同步 zh-CN / en-US |
| [启动与部署流程.md](./启动与部署流程.md) | `dev:pc` / `dev:admin` 与浏览器自启动 |
