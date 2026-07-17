# 兜行 API 接口文档

> **版本**：与代码同步（含 **双 Token 无感刷新** · C7 Agent · **C7-W W0～W5 流程编排** · H3 旅行宠物 · **M5 行中 H7/H8** · **H10-a/b/c 路线可信度** · **I3 微调模型** · J1～J5+ 旅程相册 · **DT5 运营大屏 geo API** · **M0～M7 发单接单 marketplace** · **E2 微信通道接线** · **M7 Partner API** · **M7-ext 评价与争议**）  
> **更新日期**：2026-07-16  
> **AI 规划执行顺序**：[AI路径规划路线图.md](./AI路径规划路线图.md)（**Step 38/39 已交付** · **Step 35→40** · **M1～M5 已验收**）  
> **流程编排（规划）**：[AI流程编排路线图.md](./AI流程编排路线图.md) — 管理端诊断/沙箱/模板 API（§24）· SSE `node_status` 画布联动  
> **发单接单（模块 B）**：[发单接单路线图.md](./发单接单路线图.md) — **MB0～MB3 ✅** · **E2 接线 ✅** · 下一沙箱真机一笔 · §25  
> **服务包**：`packages/server`（Express + MySQL）  
> **类型契约**：`@douxing/shared`（`types.ts`、`constants.ts`）

---

## Apifox 导入（推荐）

接口定义以 **OpenAPI 3.0** 机器可读文件为准，可直接导入 Apifox：

| 文件 | 说明 |
|------|------|
| **[openapi.yaml](./openapi.yaml)** | OpenAPI **103** 路径 / **122** 操作（Apifox 导入）；人类可读全量 **125** 项见 §2 总览 |

**导入步骤**

1. 打开 Apifox → 选择目标项目  
2. **项目设置** → **导入数据**（或左上角 **导入**）  
3. 格式选 **OpenAPI** / **Swagger**  
4. 选择本仓库 `docs/openapi.yaml`（或拖入文件）  
5. 导入后检查 **环境变量**：将 `servers` 中的 `http://localhost:3000` 设为当前环境  
6. 在 **Auth / 鉴权** 中配置：`Bearer Token`，值来自 `POST /api/auth/login` 返回的 `data.token`（Access Token）  
7. 可选：环境变量 `refreshToken` 存 `data.refreshToken`，用于手动调 `POST /api/auth/refresh`；日常业务由客户端拦截器自动 refresh

> 双 Token 机制详见 [双Token认证与无感刷新.md](./双Token认证与无感刷新.md)

**Apifox 环境建议**

| 变量名 | 示例值 | 用途 |
|--------|--------|------|
| `baseUrl` | `http://localhost:3000` | 与 OpenAPI `servers.url` 一致 |
| `token` | `eyJhbG...` | Access Token（JWT），用于 `Authorization: Bearer {{token}}` |
| `refreshToken` | `xYz...` | Refresh Token，用于 `POST /api/auth/refresh`（Apifox 手动续期时可配） |

> 修改 `packages/server/src/routes/**` 后，请同步更新 `docs/openapi.yaml`，再于 Apifox 中 **重新导入** 或 **合并更新**。

---

## 目录

1. [通用约定](#1-通用约定)
2. [接口总览](#2-接口总览)
3. [系统与健康检查](#3-系统与健康检查)
4. [认证 auth](#4-认证-auth)
5. [用户 users](#5-用户-users)
6. [景点 attractions](#6-景点-attractions)
7. [路线 routes](#7-路线-routes)
8. [规划会话 plan-sessions](#8-规划会话-plan-sessions)
9. [打卡 checkins](#9-打卡-checkins)
10. [订单 orders](#10-订单-orders)
11. [支付 payments](#11-支付-payments)
12. [成就 achievements](#12-成就-achievements)
13. [徽章 badges](#13-徽章-badges)
14. [排行榜 leaderboard](#14-排行榜-leaderboard)
15. [语音 speech](#15-语音-speech)
16. [分享 share](#16-分享-share)
17. [玩法动线 playbooks](#17-玩法动线-playbooks)
18. [旅程相册 journey-albums](#18-旅程相册-journey-albums)
19. [数据分析 analytics](#19-数据分析-analytics)
20. [旅行宠物 pets](#20-旅行宠物-pets)
21. [Agent Tools（内网）](#21-agent-tools内网)
22. [静态资源 uploads](#22-静态资源-uploads)
23. [附录：常用枚举](#23-附录常用枚举)
24. [管理端 AI 流程编排](#24-管理端-ai-流程编排admin)
25. [发单接单 marketplace](#25-发单接单-marketplace)

---

## 1. 通用约定

### 1.1 基址

| 环境 | 基址示例 |
|------|----------|
| 本地开发 | `http://localhost:3000` |
| 生产 | 见 `API_PUBLIC_BASE_URL` / `https://api.yxtao.site` |

所有 JSON API 前缀为 **`/api`**（`@douxing/shared` 中 `API_PREFIX = '/api'`）。

### 1.2 请求头

| Header | 说明 |
|--------|------|
| `Authorization` | 需登录接口：`Bearer <Access Token JWT>` |
| `Content-Type` | JSON 体：`application/json`；上传：`multipart/form-data` |
| `Accept-Language` | 可选，`zh-CN`（默认）或 `en-US`；影响 `message` 文案 |

### 1.3 统一响应体

```json
{
  "code": 0,
  "message": "成功",
  "messageKey": "api.ok",
  "data": { }
}
```

| 字段 | 说明 |
|------|------|
| `code` | `0` 成功；非 0 业务错误 |
| `message` | 人类可读文案（随 `Accept-Language`） |
| `messageKey` | 稳定 i18n 键，见 `ApiMessageKey` |
| `data` | 业务数据；失败时多为 `null` |

HTTP 状态码：多数业务错误仍返回 **200** + `code !== 0`；鉴权失败 **401**、无权 **403**、资源不存在 **404** 等也会配合使用。

### 1.4 分页

查询参数：`page`（默认 1）、`pageSize`（默认 20，最大 100）。

分页响应（`PaginatedResult<T>`）：

```json
{
  "items": [],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "hasMore": true
}
```

### 1.5 鉴权说明

| 标记 | 含义 |
|------|------|
| 公开 | 无需 Token |
| 登录 | 需有效 Access Token（JWT） |
| 管理员 | 需 Access Token 且角色含 `admin` |

### 1.6 静态资源 URL

数据库存 **相对路径**（如 `/uploads/photos/2/xxx.jpg`）或 **OSS/CDN 完整 URL**。  
接口返回时会按 `API_PUBLIC_BASE_URL` 或当前请求 Host 拼完整 URL。

---

## 2. 接口总览

| # | 方法 | 路径 | 鉴权 | 模块 |
|---|------|------|------|------|
| 1 | GET | `/` | 公开 | 系统 |
| 2 | GET | `/api/health` | 公开 | 系统 |
| 3 | POST | `/api/auth/register` | 公开 | 认证 |
| 4 | POST | `/api/auth/login` | 公开 | 认证 |
| 5 | POST | `/api/auth/sms/send` | 公开 | 认证 |
| 6 | POST | `/api/auth/sms/login` | 公开 | 认证 |
| 7 | POST | `/api/auth/refresh` | 公开 | 认证 |
| 8 | POST | `/api/auth/logout` | 公开 | 认证 |
| 9 | GET | `/api/auth/me` | 登录 | 认证 |
| 10 | GET | `/api/users/me` | 登录 | 用户 |
| 9 | PUT | `/api/users/me` | 登录 | 用户 |
| 10 | GET | `/api/users/me/membership` | 登录 | 用户 |
| 11 | GET | `/api/users/me/storage` | 登录 | 用户 |
| 12 | POST | `/api/users/me/avatar` | 登录 | 用户 |
| 12.1 | POST | `/api/users/me/onboarding/complete` | 登录 | 首次引导 P-ONBOARD-01 |
| 13 | GET | `/api/attractions` | 公开 | 景点 |
| 14 | GET | `/api/attractions/cities` | 公开 | 景点 |
| 15 | GET | `/api/attractions/:id` | 公开 | 景点 |
| 16 | GET | `/api/attractions/admin/pending` | 管理员 | 景点 |
| 17 | GET | `/api/attractions/admin/catalog` | 管理员 | 景点 |
| 18 | POST | `/api/attractions/admin/:id/cover` | 管理员 | 景点 |
| 19 | POST | `/api/attractions/admin/:id/cover/refresh-amap` | 管理员 | 景点 |
| 20 | POST | `/api/attractions/admin/:id/approve` | 管理员 | 景点 |
| 20.1 | PATCH | `/api/attractions/admin/:id/scene-tags` | 管理员 | 景点场景标签 P-TAG-01 |
| 21 | GET | `/api/routes/llm-providers` | 公开 | 路线 |
| 22 | GET | `/api/routes/llm-status` | 公开 | 路线 |
| 23 | POST | `/api/routes/generate` | 登录 | 路线 |
| 24 | GET | `/api/routes` | 登录 | 路线 |
| 25 | GET | `/api/routes/plaza` | 登录 | 路线 |
| 26 | GET | `/api/routes/hot` | 登录 | 路线（兼容） |
| 27 | GET | `/api/routes/:id` | 登录 | 路线 |
| 28 | PUT | `/api/routes/:id` | 登录 | 路线 |
| 29 | POST | `/api/routes/:id/publish` | 登录 | 路线 |
| 30 | POST | `/api/routes/:id/regenerate` | 登录 | 路线 |
| 31 | POST | `/api/routes/:id/like` | 登录 | 路线 |
| 32 | POST | `/api/routes/:id/favorite` | 登录 | 路线 |
| 33 | POST | `/api/routes/:id/share` | 登录 | 路线 |
| 34 | GET | `/api/routes/:id/comments` | 登录 | 路线 |
| 35 | POST | `/api/routes/:id/comments` | 登录 | 路线 |
| 36 | GET | `/api/routes/:id/map-path` | 登录 | 路线 |
| 37 | POST | `/api/routes/:id/replan/preview` | 登录 | 行中 H8 |
| 38 | POST | `/api/routes/:id/replan/apply` | 登录 | 行中 H8 |
| 39 | POST | `/api/routes/:id/missed-pois/analyze` | 登录 | 行中 H7 |
| 40 | POST | `/api/routes/:id/missed-pois/record` | 登录 | 行中 H7 |
| 41 | GET | `/api/routes/plan-sessions` | 登录 | 规划 |
| 42 | POST | `/api/routes/plan-sessions` | 登录 | 规划 |
| 43 | GET | `/api/routes/plan-sessions/:sessionId` | 登录 | 规划 |
| 44 | POST | `/api/routes/plan-sessions/:sessionId/messages` | 登录 | 规划 |
| 45 | POST | `/api/routes/plan-sessions/:sessionId/select-candidate` | 登录 | 规划 |
| 46 | GET | `/api/routes/plan-sessions/:sessionId/stream` | 登录 | 规划 SSE（C7-b Step 7） |
| 47 | POST | `/api/checkins/photos` | 登录 | 打卡 |
| 48 | POST | `/api/checkins` | 登录 | 打卡 |
| 49 | GET | `/api/checkins` | 登录 | 打卡 |
| 50 | GET | `/api/orders/payment-config` | 登录 | 订单 |
| 51 | POST | `/api/orders` | 登录 | 订单 |
| 52 | GET | `/api/orders` | 登录 | 订单 |
| 53 | GET | `/api/orders/:id` | 登录 | 订单 |
| 54 | POST | `/api/orders/:id/prepay` | 登录 | 订单 |
| 55 | POST | `/api/orders/:id/pay` | 登录 | 订单 |
| 56 | POST | `/api/orders/:id/cancel` | 登录 | 订单 |
| 57 | POST | `/api/payments/wechat/notify` | 微信回调 | 支付 |
| 58 | GET | `/api/achievements/catalog` | 登录 | 成就 |
| 59 | GET | `/api/achievements/mine` | 登录 | 成就 |
| 60 | GET | `/api/achievements` | 登录 | 成就（兼容） |
| 61 | GET | `/api/badges` | 登录 | 徽章 |
| 62 | GET | `/api/badges/mine` | 登录 | 徽章 |
| 63 | GET | `/api/leaderboard` | 登录 | 排行榜 |
| 64 | POST | `/api/speech/transcribe` | 登录 | 语音 |
| 65 | GET | `/api/share/journey-albums/:token` | 公开 | 分享 |
| 66 | GET | `/api/share/routes/:id` | 公开 | 分享 |
| 67 | GET | `/api/share/routes/:id/wxacode` | 公开 | 分享 |
| 68 | GET | `/api/share/routes/:id/link` | 公开 | 分享 |
| 69 | GET | `/api/playbooks/admin` | 管理员 | 动线 |
| 70 | GET | `/api/playbooks/admin/:id` | 管理员 | 动线 |
| 71 | POST | `/api/playbooks/admin` | 管理员 | 动线 |
| 72 | PUT | `/api/playbooks/admin/:id` | 管理员 | 动线 |
| 73 | DELETE | `/api/playbooks/admin/:id` | 管理员 | 动线 |
| 74 | GET | `/api/journey-albums` | 登录 | 相册 |
| 75 | GET | `/api/journey-albums/photos` | 登录 | 相册 |
| 76 | GET | `/api/journey-albums/by-route/:routeId` | 登录 | 相册 |
| 77 | POST | `/api/journey-albums` | 登录 | 相册 |
| 78 | GET | `/api/journey-albums/:id` | 登录 | 相册 |
| 79 | POST | `/api/journey-albums/:id/photos` | 登录 | 相册 |
| 80 | POST | `/api/journey-albums/:id/share` | 登录 | 相册 |
| 81 | POST | `/api/journey-albums/:id/photos/apply-exif-suggestions` | 登录 | 相册 |
| 82 | PATCH | `/api/journey-albums/:id/photos/:photoId` | 登录 | 相册 |
| 83 | DELETE | `/api/journey-albums/:id/photos/:photoId` | 登录 | 相册 |
| 84 | DELETE | `/api/journey-albums/:id` | 登录 | 相册 |
| 85 | GET | `/api/analytics/overview` | 管理员 | 数据分析 |
| 86 | GET | `/api/analytics/trends` | 管理员 | 数据分析 |
| 87 | GET | `/api/analytics/top-cities` | 管理员 | 数据分析 |
| 88 | GET | `/api/analytics/funnel` | 管理员 | 数据分析 |
| 89 | POST | `/api/analytics/events` | 登录可选 | 数据分析（DT3 埋点） |
| 90 | POST | `/api/analytics/events/batch` | 登录可选 | 数据分析（DT3 批量埋点） |
| 91 | GET | `/api/analytics/geo/distribution` | 管理员 | 数据分析（DT5 地理分布） |
| 92 | GET | `/api/analytics/geo/flows` | 管理员 | 数据分析（DT5 城际 OD） |
| 93 | GET | `/api/analytics/system-resources` | 管理员 | 数据分析（系统资源 / 远程 Git） |
| 94 | POST | `/api/pets/adopt` | 登录 | 旅行宠物 |
| 95 | GET | `/api/pets/me` | 登录 | 旅行宠物 |
| 96 | PATCH | `/api/pets/me` | 登录 | 旅行宠物 |
| 97 | GET | `/api/pets/me/floating-context` | 登录 | 旅行宠物 |
| 98 | GET | `/api/pets/me/memories` | 登录 | 旅行宠物 |
| 99 | POST | `/api/pets/me/memories` | 登录 | 旅行宠物 |
| 100 | PATCH | `/api/pets/me/memories/:id` | 登录 | 旅行宠物 |
| 101 | DELETE | `/api/pets/me/memories/:id` | 登录 | 旅行宠物 |
| 102 | POST | `/api/pets/me/analyze` | 登录 | 旅行宠物 |
| 103 | GET | `/api/routes/:routeId/media` | 登录 | 路线视频 H10 |
| 104 | POST | `/api/routes/:routeId/media` | 登录 | 路线视频 H10 |
| 105 | DELETE | `/api/routes/:routeId/media/:mediaId` | 登录 | 路线视频 H10 |
| 106 | GET | `/api/attractions/admin/media/pending` | 管理员 | 视频审核 H10 |
| 107 | PATCH | `/api/attractions/admin/media/:mediaId/review` | 管理员 | 视频审核 H10 |
| 108 | GET | `/api/admin/plan-sessions/recent` | 管理员 | 规划诊断 · 最近会话 |
| 109 | POST | `/api/admin/plan-sessions/sandbox-run` | 管理员 | 规划沙箱（同步） |
| 110 | POST | `/api/admin/plan-sessions/sandbox-run/async` | 管理员 | 规划沙箱（异步 + SSE） |
| 111 | GET | `/api/admin/plan-sessions/:sessionId/stream` | 管理员 | 规划沙箱 SSE |
| 112 | GET | `/api/admin/plan-sessions/:sessionId/workflow-trace` | 管理员 | 规划诊断 · NodeSpan 时间线 |
| 113 | GET | `/api/admin/plan-sessions/:sessionId/cost-summary` | 管理员 | 规划诊断 · 费用汇总 |
| 114 | GET | `/api/admin/workflow-templates/default-graph` | 管理员 | 工作流模板 · 默认参考图 |
| 115 | POST | `/api/admin/workflow-templates/validate-graph` | 管理员 | 工作流模板 · 图校验 |
| 116 | GET | `/api/admin/workflow-templates` | 管理员 | 工作流模板列表 |
| 117 | POST | `/api/admin/workflow-templates` | 管理员 | 创建工作流模板 |
| 118 | GET | `/api/admin/workflow-templates/:id` | 管理员 | 工作流模板详情 |
| 119 | PUT | `/api/admin/workflow-templates/:id` | 管理员 | 更新工作流模板 |
| 120 | POST | `/api/admin/workflow-templates/:id/publish-graph` | 管理员 | 发布模板 DAG 图 |
| 121 | DELETE | `/api/admin/workflow-templates/:id` | 管理员 | 删除工作流模板 |
| 122 | GET | `/api/marketplace/health` | 公开 | 发单接单 M0 |
| 123 | GET | `/api/marketplace/categories` | 公开 | 发单接单 M0 |
| 124 | GET | `/api/marketplace/demands/mine` | 登录 | 发单接单 M0 |
| 125 | GET | `/api/marketplace/demands/:id` | 登录 | 发单接单 M0 |
| 126 | GET | `/api/marketplace/admin/orgs` | 管理员 | 发单接单 M0 |

> 注：`/api/system/*` 等系统管理接口见 [系统管理.md](./系统管理.md)，未纳入上表 **126** 项主链。含 `GET /api/system/logs/api`（接口日志）。管理端导航菜单树：`GET /api/system/menus/tree`（登录 + 按角色过滤）。

---

## 3. 系统与健康检查

### GET `/`

根路径健康探测。

**响应 `data`**：`{ name, status: 'ok' }`

### GET `/api/health`

**响应 `data`**：

| 字段 | 说明 |
|------|------|
| `name` | 应用名「兜行」 |
| `status` | `ok` |
| `timestamp` | ISO 时间 |
| `checkin` | 打卡配置摘要（围栏开关等） |

---

## 4. 认证 auth

前缀：`/api/auth`

> 双 Token 流程、客户端拦截与验收见 [双Token认证与无感刷新.md](./双Token认证与无感刷新.md)。

### POST `/register`

用户名密码注册。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 3～32 字符 |
| `password` | string | 是 | 6～64 字符 |
| `nickname` | string | 否 | 昵称 |

**响应 `data`**：`LoginResult`（见下）

### POST `/login`

**Body**：`{ username, password }`

**响应 `data`**：`LoginResult`

### POST `/sms/send`

发送手机验证码。

**Body**：`{ phone }` — 大陆 11 位手机号

**响应 `data`**：发送结果（含 mock 模式提示）

### POST `/sms/login`

验证码登录；未注册手机号自动注册。

**Body**：`{ phone, code }` — 验证码 6 位

**响应 `data`**：`LoginResult`

### POST `/refresh`

使用 Refresh Token 换取新的 Access Token 与 Refresh Token（**轮换**：旧 refresh 立即吊销）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `refreshToken` | string | 是 | 登录时下发的 refresh 明文 |

**响应 `data`**：`RefreshTokenResult` — `{ token, refreshToken, expiresIn }`

**错误**：无效/已吊销 → `401` + `api.refreshTokenInvalid`；用户禁用 → `401` + `api.refreshTokenExpired`

### POST `/logout`

吊销 Refresh Token（Access Token 仍自然过期，客户端须清本地凭证）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `refreshToken` | string | 否 | 有则服务端吊销；无则仅返回成功 |

**响应 `data`**：`null`，`messageKey`: `api.logoutSuccess`

### GET `/me`

当前登录用户（含角色）。

**响应 `data`**：`UserInfo`

#### LoginResult / RefreshTokenResult

```typescript
interface LoginResult {
  token: string;        // Access Token（JWT）
  refreshToken: string;
  expiresIn: number;    // Access 有效期（秒）
  user: UserInfo;
}

interface RefreshTokenResult {
  token: string;
  refreshToken: string;
  expiresIn: number;
}
```

---

## 5. 用户 users

前缀：`/api/users`

### GET `/me`

同 `GET /api/auth/me`，返回 `UserInfo`。

### PUT `/me`

更新资料。

**Body**（均可选，至少一项）

| 字段 | 类型 | 说明 |
|------|------|------|
| `nickname` | string | 1～64 字符 |
| `avatar` | string \| null | 头像 URL 或相对路径 |
| `email` | string \| null | 邮箱 |
| `interestTags` | string[] | 兴趣标签，上限见 `USER_INTEREST_MAX` |

**响应 `data`**：`UserInfo`

### GET `/me/membership`

**响应 `data`**：会员权益信息（等级、规划候选数等）

### GET `/me/storage`

用户旅行照片存储用量（J2 会员配额）。

**响应 `data`**：`UserPhotoStorageInfo`

| 字段 | 说明 |
|------|------|
| `level` | 会员等级 `MemberLevel` |
| `usedBytes` / `maxBytes` | 已用 / 容量上限（字节） |
| `usedCount` / `maxCount` | 已用 / 张数上限 |
| `maxFileBytes` | 单张大小上限 |

### POST `/me/avatar`

上传头像（multipart）。

| 表单字段 | 说明 |
|----------|------|
| `file` | 图片，≤ 2MB，支持 jpg/png/webp/gif |

**响应 `data`**：`UserInfo`（含新头像 URL）

---

## 6. 景点 attractions

前缀：`/api/attractions`

### GET `/`

景点列表（仅已发布）。

**Query**

| 参数 | 说明 |
|------|------|
| `city` | 城市名 |
| `cityCode` | 城市编码 |
| `category` | `attraction` \| `restaurant` \| `hotel` |
| `keyword` | 关键词 |
| `tags` | 标签，逗号分隔或数组 |
| `limit` | 1～100 |
| `offset` | 偏移 |

**响应 `data`**：`AttractionInfo[]`

### GET `/cities`

有景点的城市汇总。

### GET `/:id`

景点详情（仅已发布）。

---

### 管理员接口

需 **admin** 角色。

#### GET `/admin/pending`

待审核景点（分页）。

#### GET `/admin/catalog`

景点管理列表。

**Query**：`city`、`keyword`、`page`、`pageSize`

#### POST `/admin/:id/cover`

上传景点封面（multipart 字段 `file`，≤ 3MB）。

#### POST `/admin/:id/cover/refresh-amap`

从高德拉取封面（非 manual 来源）。

#### POST `/admin/:id/approve`

审核通过 pending 景点。

#### PATCH `/admin/:id/scene-tags`

更新景点场景标签（P-TAG-01 · 管理员维护）。

**Body**：`{ sceneTags: string[] }`（slug 列表，覆盖现有；非法 slug 会被 `normalizeSceneTags` 过滤）

**返回**：`AttractionInfo`（含更新后的 `sceneTags`）

**权限**：`requirePerm`（景点管理）

#### GET `/admin/media/pending`

待审核路线视频列表（H10-b · 分页）。

#### PATCH `/admin/media/:mediaId/review`

审核路线视频。

**Body**：`{ status: 'approved' | 'rejected', rejectReason?: string }`

---

## 7. 路线 routes

前缀：`/api/routes`

### GET `/llm-providers`

可选 LLM 提供商列表。

**响应 `data`**：`{ options: [...] }`

### GET `/llm-status`

检测 DeepSeek / LM Studio / **兜行微调（douxing）** / ai-service 可用性。

**响应 `data`** 含 `douxingConfigured`、`douxingEnabled`（百炼 `DOUXING_LLM_*` 是否配置/启用）。

### POST `/generate`

一句话生成路线（单轮，无会话）。

**Body**

| 字段 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 旅行需求，≥ 2 字 |
| `days` | number | 可选，1～7 |
| `budget` | string | 可选 |
| `provider` | string | `auto` \| `deepseek` \| `lmstudio` \| `douxing` |

**响应 `data`**：`TravelRouteInfo` + `generationSource`、`llmProvider`

### GET `/`

路线列表。

**Query**

| 参数 | 说明 |
|------|------|
| `scope` | `mine` \| `plaza` \| `favorites` \| `hot` |
| `status` | 0 草稿 / 1 已发布 / 2 归档 |
| `sort` | `recent` \| `hot` \| `views` |
| `page` / `pageSize` / `limit` | 分页 |
| `all=1` | **管理员**：全站路线 |

**响应 `data`**：`PaginatedResult<TravelRouteInfo>`

列表项 `TravelRouteInfo` 含可选字段 **`listCoverImageUrl`**：服务端批量填充，优先旅程相册封面图，其次路线 POI/景点封面（`route-list-cover.service`）；用于 mobile/pc 路线卡片缩略图。

### GET `/plaza`

广场公开路线（`isPublic=1`），默认真按热度。

### GET `/hot`

**已废弃**，行为同 `/plaza`。

### GET `/:id`

路线详情（非所有者仅可看已发布且公开路线；浏览量 +1）。

### PUT `/:id`

编辑 **草稿** 路线。

**Body**（均可选）：`name`、`description`、`budgetRange`、`days`、`interestTags`、`routeDetail`

### POST `/:id/publish`

发布路线。

### POST `/:id/regenerate`

AI 重新生成（仅 AI 草稿/已生成路线，已发布不可）。

**Body**：同 `/generate`

### POST `/:id/like`

点赞/取消。**响应**：`{ liked, likeCount }`

### POST `/:id/favorite`

收藏/取消。**响应**：`{ favorited, collectCount }`

### POST `/:id/share`

公开/取消公开到广场。

**Body**：`{ isPublic: boolean }`（公开前须已发布）

### GET `/:id/comments`

评论列表。

**Query**：`limit`（默认 50）· `dayIndex`（0-based 天索引，可选）· `attractionId`（POI 景点 ID，可选）

### POST `/:id/comments`

发表评论（仅广场公开路线）。

**Body**

| 字段 | 类型 | 说明 |
|------|------|------|
| `content` | string | 1～500 字 |
| `dayIndex` | number | 可选，绑定评论上下文天索引 |
| `attractionId` | number | 可选，绑定 POI |
| `poiName` | string | 可选，POI 名称（无 attractionId 时） |

### GET `/:routeId/media`

列出路线绑定视频（H10-b）。作者可见全部状态；他人仅已通过审核。

### POST `/:routeId/media`

上传路线或 POI 短视频（multipart · H10-b）。

**Form 字段**

| 字段 | 说明 |
|------|------|
| `file` | 视频文件（≤50MB · ≤60s） |
| `scope` | `route` \| `poi` |
| `durationSec` | 视频时长（秒） |
| `dayIndex` | POI 绑定时必填（0-based） |
| `attractionId` / `poiName` | POI 绑定时二选一或同时 |
| `coverUrl` | 可选封面 |

dev 环境或 `ROUTE_MEDIA_AUTO_APPROVE=true` 时自动过审。

### DELETE `/:routeId/media/:mediaId`

删除本人上传的视频。

### GET `/:id/map-path`

路线地图 polyline（需有查看权限）。

**Query**：`day` — 可选，指定某天 0-based 索引

**响应 `data`**：地图路径对象（含 polyline、节点等）

### POST `/:id/replan/preview`

行中局部重规划预览（H8 · Step 31～32）。基于 GPS + 剩余 POI 重算当日 segment；**不直接写库**。

**Body**

| 字段 | 类型 | 说明 |
|------|------|------|
| `context.dayIndex` | number | 0-based 天索引 |
| `context.latitude` / `longitude` | number | 当前 GPS |
| `context.currentTimeMinutes` | number? | 当前时刻（分钟，0=00:00） |
| `context.visitedPoiNames` | string[]? | 已访问 POI 名（模糊匹配） |
| `context.remainingPoiNames` | string[]? | 显式剩余 POI（优先于推断） |
| `context.gpsLabel` | string? | GPS 展示标签 |

**响应 `data`**：`RouteReplanPreviewResponse` — `preview`（segment + diff）、`canApply`（仅草稿 true）、`toolTrace?`

**验收**：`pnpm --filter @douxing/server replan-segment:cases` · `h8:transit-agent-cases`

### POST `/:id/replan/apply`

确认写回重规划结果（**仅草稿**；已发布 → `ROUTE_DRAFT_ONLY_EDIT`）。

**Body**：同 preview  
**响应 `data`**：更新后的 `TravelRouteInfo`

### POST `/:id/missed-pois/analyze`

H7 · 对比计划 POI 与打卡/GPS，返回「应到未到」列表与 RAG 替补推荐。

**Body**

| 字段 | 类型 | 说明 |
|------|------|------|
| `dayIndex` | number | 评估截至第几天（含），0-based |
| `currentTimeMinutes` | number? | 当前时刻 |
| `autoRecordRegrets` | boolean? | 是否自动写入 regret 记忆 |

**响应 `data`**：`RouteMissedPoiAnalyzeResponse` — `missed[]`、`alternatives[]`、`recordedMemoryIds?`

### POST `/:id/missed-pois/record`

将选定遗漏 POI 记入遗憾记忆（`pet_memories` · `memoryType=regret`）。

**Body**：`{ items: [{ name, dayIndex }] }`  
**响应 `data`**：`{ memoryIds, skipped }`

**验收**：`pnpm --filter @douxing/server h7:missed-poi-cases`

---

## 8. 规划会话 plan-sessions

前缀：`/api/routes/plan-sessions`  
多轮对话规划 + 多方案候选（C1/C4）。

### GET `/`

我的规划会话列表。

**Query**：`limit`（1～50，默认 20）

**响应 `data`**：`PlanSessionSummary[]`

### POST `/`

创建会话并生成首条方案。

**Body**：同 `POST /api/routes/generate`

**响应 `data`**：`PlanSessionActionResult`（含 `sessionId`、`candidates`、`agentState` 等）

`agentState`（C7-b，追问且 Agent 开启时更新）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `lastRoutedIntent` | string | 最近一次意图路由，如 `tweak_day` |
| `generationPath` | `'agent'` \| `'pipeline'` | Agent 成功 / 管道降级 |
| `toolTrace` | `{ tool, ok, ms }[]` | Tool 调用链（非字符串） |
| `assistantHint` | string? | Agent 侧提示（可选） |

### GET `/:sessionId`

会话详情（消息、路线、候选）。

**响应 `data`**：`PlanSessionInfo`（含 `agentState`，结构同上）

### POST `/:sessionId/messages`

追问/修改方案。

**Body**：`{ content: string }` — 1～500 字

**响应 `data`**：`PlanSessionActionResult`

### GET `/:sessionId/stream`

规划追问 **SSE 流式进度**（C7-b Step 7）。客户端在 `POST .../messages` 前后订阅均可；连接期间重放当前缓冲事件。

**鉴权**：`Authorization: Bearer` 或 query `?token=<JWT>`（`EventSource` 无法自定义 Header 时使用后者）

**响应**：`Content-Type: text/event-stream`

| 事件 | payload | 说明 |
|------|---------|------|
| `tool_call` | `{ tool, status: 'running'\|'done'\|'failed', ms?, nodeId?, inputDigest?, outputDigest? }` | Tool 进度；`tool` 对应 shared `agent.status.*`；`nodeId` 可与画布节点对齐 |
| `node_status` | `{ nodeId, status: 'running'\|'success'\|'failed', routedIntent?, ms? }` | 编排类节点（start/subgraph/condition/branch/end）状态；LangGraph 模式下由 ai-service 推送 |
| `assistant` | `{ delta?, final? }` | 助手回复片段或最终文案 |
| `done` | `{ result: PlanSessionActionResult }` | 规划完成 |
| `error` | `{ messageKey, params? }` | 失败（ApiMessageKey） |

**超时**：连接最长约 `AGENT_PLAN_TIMEOUT_MS + 30s`；空闲心跳 `: heartbeat` 每 15s

**说明**：当前首条 `POST /` 创建会话不走 SSE；追问 `POST .../messages` 会推送 Tool 链。PC / mobile H5 通过 `fetch` 订阅 SSE；小程序等环境自动降级为 POST 响应 `toolTrace`。

### POST `/:sessionId/select-candidate`

切换候选方案。

**Body**：`{ routeId: number }`

**响应 `data`**：`PlanSessionActionResult`

---

## 9. 打卡 checkins

前缀：`/api/checkins`

### POST `/photos`

上传打卡照片（multipart）。

| 表单字段 | 说明 |
|----------|------|
| `file` | 图片，≤ 2MB |

**响应 `data`**：`{ url, path }` — 公网 URL 与 DB 相对路径

### POST `/`

创建打卡（含地理围栏校验）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `routeId` | number | 是 | 路线 ID |
| `location` | object | 是 | `latitude`、`longitude`、`placeName`；可选 `address` |
| `attractionId` | number | 否 | 关联景点 |
| `cityCode` / `cityName` | string | 否 | 城市 |
| `targetLatitude` / `targetLongitude` | number | 否 | 围栏目标坐标 |
| `gpsAccuracy` | number | 否 | GPS 精度（米） |
| `photos` | string[] | 否 | 已上传图片 URL，最多 3 张 |
| `remark` | string | 否 | 备注 |

**响应 `data`**：`CheckInResult` — `{ checkIn, newAchievements, newBadges }`

### GET `/`

打卡列表（分页）。

**Query**

| 参数 | 说明 |
|------|------|
| `page` / `pageSize` | 分页 |
| `range` | `7d` \| `30d` \| `90d` \| `all` |
| `routeId` | 指定路线的打卡 |
| `all=1` | **管理员**：全站打卡 |

---

## 10. 订单 orders

前缀：`/api/orders`

### GET `/payment-config`

**响应 `data`**：

| 字段 | 说明 |
|------|------|
| `mode` | 支付模式 |
| `wechatConfigured` | 微信支付是否配置 |
| `routeUnlockPaymentRequired` | 路线解锁是否强制支付 |

### POST `/`

创建路线解锁订单。

**Body**：`{ routeId: number }`

**响应 `data`**：`OrderInfo`

### GET `/`

我的订单（分页）。

**Query**：`tab` — `all` \| `pending` \| `done`；`all=1` 管理员全站

### GET `/:id`

订单详情。

### POST `/:id/prepay`

微信 JSAPI 预下单。

**Body**：`{ wxCode?: string }` — 小程序 login code

**响应 `data`**：`OrderPrepayResult`

### POST `/:id/pay`

模拟支付（开发/MVP）。

### POST `/:id/cancel`

取消 pending 订单。

---

## 11. 支付 payments

### POST `/api/payments/wechat/notify`

微信支付异步通知（**非 JSON 中间件**，raw body）。  
由微信服务器调用，无需 JWT。响应格式遵循微信支付协议。

---

## 12. 成就 achievements

前缀：`/api/achievements`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/catalog` | 成就图鉴（含解锁状态与进度） |
| GET | `/mine` | 已解锁成就 |
| GET | `/` | 兼容旧版，同 `/mine` |

**响应 `data`**：`AchievementCatalogItem[]` 或 `AchievementInfo[]`

---

## 13. 徽章 badges

前缀：`/api/badges`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 徽章图鉴（含进度） |
| GET | `/mine` | 已解锁徽章 |

---

## 14. 排行榜 leaderboard

### GET `/api/leaderboard`

**Query**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `period` | `week` | `week` \| `month` |
| `metric` | `checkins` | `checkins` \| `points` |
| `limit` | — | 1～`LEADERBOARD_MAX_LIMIT` |

**响应 `data`**：`LeaderboardResult` — 含 `entries`、`myRank`、`myValue`

---

## 15. 语音 speech

### POST `/api/speech/transcribe`

语音转文字（腾讯云 ASR）。

**multipart 字段**：`audio` — ≤ 10MB

**响应 `data`**：`{ text: string }`

---

## 16. 分享 share

前缀：`/api/share` — **均无需登录**

### GET `/journey-albums/:token`

公开旅程相册只读（J5 H5 分享页）。相册须已开启分享且 token 有效。

**响应 `data`**：`SharedJourneyAlbumPayload`（标题、路线名、封面、分组照片）

### GET `/routes/:id`

公开路线只读摘要（D5-a H5 分享页）。

### GET `/routes/:id/wxacode`

返回 **PNG** 小程序码（需配置微信 AppId/Secret）。

### GET `/routes/:id/link`

**响应 `data`**：`{ url: string }` — 微信 URL Link

---

## 17. 玩法动线 playbooks

前缀：`/api/playbooks` — **管理员 CRUD**（H9+-2）

### GET `/admin`

动线列表（分页）。

**Query**：`city`、`keyword`、`enabled`、`page`、`pageSize`

### GET `/admin/:id`

动线详情（`:id` 为 slug，如 `hangzhou-west-lake`）。

### POST `/admin`

创建动线。

**Body**：`RoutePlaybookInfo` 结构 — `id`、`city`、`scope`、`keywords`、`themes`、`classicOrder`、`segments`、`summaryZh`、`summaryEn` 等

### PUT `/admin/:id`

部分更新动线。

### DELETE `/admin/:id`

删除动线。

---

## 18. 旅程相册 journey-albums

前缀：`/api/journey-albums` — **J1～J5 旅程相册**（含 J5+ 拍摄参数与同参数拼图）

一路线一相册；照片按天/POI 分组；上传解析 EXIF（GPS + `shootingParams`）；详见 [旅行照片存储系统.md](./旅行照片存储系统.md)。

### GET `/`

我的相册列表。

**响应 `data`**：`{ items: JourneyAlbumSummary[] }`

### GET `/photos`

用户全站旅行照片分页列表。

**Query**：`page`、`pageSize`

**响应 `data`**：分页结构，`items` 为 `UserTravelPhotoListItem[]`（含 `albumTitle`、`routeId`、`routeName`）

### GET `/by-route/:routeId`

按路线获取相册详情；若不存在则自动创建后返回。

**响应 `data`**：`JourneyAlbumDetail`

### POST `/`

为路线创建相册（须为路线所有者；已存在则幂等返回）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `routeId` | number | 是 | 路线 ID |
| `title` | string | 否 | 默认路线名 |

**响应 `data`**：`JourneyAlbumSummary`

### GET `/:id`

相册详情 + 分组树。

**响应 `data`**：`JourneyAlbumDetail`

| 字段 | 说明 |
|------|------|
| `photos` | 全部照片 flat 列表 |
| `groups` | 按 `dayIndex` + `poiName` 分组 |

### POST `/:id/photos`

上传照片（multipart）。

| 表单字段 | 说明 |
|----------|------|
| `file` | 图片，≤ 10MB（`TRAVEL_PHOTO_MAX_FILE_BYTES`） |
| `dayIndex` | 可选，0-based 天索引 |
| `poiName` | 可选，POI 名称 |
| `attractionId` | 可选 |
| `caption` | 可选，备注 |
| `sortOrder` | 可选，排序 |

**响应 `data`**：`TravelPhotoInfo`（含可选 `placementSuggestion`：EXIF GPS 建议归类；`shootingParams`：EXIF 拍摄参数）

**`TravelPhotoShootingParams` 字段**（均可为 null）：`deviceMake`、`deviceModel`、`lensModel`、`iso`、`fNumber`、`exposureTimeSec`、`focalLengthMm`、`focalLength35mm`、`flash`、`whiteBalance`

### POST `/:id/share`

开启或关闭相册公开分享。

**Body**：`{ enabled: boolean }`

**响应 `data`**：`JourneyAlbumShareState`（`shareEnabled`、`shareToken`、`sharePath`）

### POST `/:id/photos/apply-exif-suggestions`

批量应用 EXIF 位置建议，将未分配照片归入天/POI。

**Body**（可选）：`{ photoIds?: number[] }` — 默认处理全部未分配照片

**响应 `data`**：`ApplyExifSuggestionsResult`（`applied`、`skipped`、`photos`）

### PATCH `/:id/photos/:photoId`

更新照片元数据。

**Body**（均可选，至少一项）：`dayIndex`、`poiName`、`attractionId`、`caption`、`sortOrder`

### DELETE `/:id/photos/:photoId`

删除照片并更新相册计数。

**响应 `data`**：`{ photoId: number }`

### DELETE `/:id`

删除整本旅程相册（须为相册所有者）。

- 级联删除相册内全部 `travel_photos` 记录，并清理磁盘/OSS 上的原图文件  
- 释放 `bytes_used` / `photo_count` 对应配额  

**响应 `data`**：`{ albumId: number }`

**messageKey**：`api.journeyAlbumDeleteSuccess` / `api.journeyAlbumDeleteFailed`

---

## 19. 数据分析 analytics

前缀：`/api/analytics`。读接口（overview/trends/top-cities/funnel/geo/system-resources）需 **管理员** JWT + `data:analytics:view`；埋点写入（`POST /events`、`/events/batch`）使用 `optionalAuthMiddleware`（**登录可选**，mobile/pc 客户端上报）。指标口径与分阶段路线见 [数据中台.md](./数据中台.md)；工程资产见 [系统资源统计.md](./系统资源统计.md)；运营大屏见 [旅行运营大屏.md](./旅行运营大屏.md)。

### GET `/overview`

核心指标概览：用户、路线、订单、打卡、规划会话的总量与近 7 日 / 今日新增。

**响应 `data`**：`AnalyticsOverview`

| 块 | 字段 | 说明 |
|----|------|------|
| `users` | `total`, `newToday`, `newLast7Days` | 用户总数与新增 |
| `routes` | `total`, `publicTotal`, `newLast7Days` | 路线；公开 = 已发布 |
| `orders` | `total`, `paidTotal`, `newLast7Days` | 订单；已支付 = PAID/COMPLETED |
| `checkins` | `total`, `approvedTotal`, `newLast7Days` | 打卡；已通过 = APPROVED |
| `planSessions` | `total`, `newLast7Days` | AI 规划会话 |
| — | `generatedAt` | ISO 生成时间 |

### GET `/trends`

按日趋势序列（**DT2**：历史日期优先读 `analytics_daily_metrics`；当天实时聚合）。

**Query**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `days` | number | 30 | 1～90，含当天 |

**响应 `data`**：`AnalyticsDailyPoint[]`

| 字段 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD` |
| `users` / `routes` / `orders` / `checkins` / `planSessions` | 当日新增计数 |

### GET `/top-cities`

打卡城市排行（已通过打卡，按 `city_code` 聚合）。

**Query**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `limit` | number | 10 | 1～50 |

**响应 `data`**：`AnalyticsCityRankItem[]` — `{ cityCode, checkinCount }`

### GET `/funnel`

旅程漏斗（**DT3**）：规划页 → 提交 → 会话 → 保存 → 发布 → 打卡，按独立 user/session 去重。

**Query**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `days` | number | 30 | 1～90 |

**响应 `data`**：`AnalyticsFunnelStep[]` — `{ stepKey, eventName, count, rateFromFirst, rateFromPrev }`

### POST `/events`

写入单条埋点事件（**DT3** mobile/pc 客户端；白名单 `eventName`；登录用户自动关联 `userId`）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `eventName` | string | 是 | 1～64 字符，如 `route.publish` |
| `eventCategory` | string | 否 | `business` / `behavior` / `system` |
| `userId` | number | 否 | 关联用户 |
| `sessionId` | string | 否 | 客户端会话 ID |
| `properties` | object | 否 | JSON 扩展属性 |
| `source` | string | 否 | `server` / `mobile` / `pc` / `web` |
| `occurredAt` | string | 否 | ISO 8601 业务发生时间 |

**响应 `data`**：`{ ok: true }`

### POST `/events/batch`

批量写入埋点（**DT3** mobile/pc）。

**Body**：`{ events: ClientAnalyticsEvent[] }`（单条字段同 `POST /events`）

**响应 `data`**：`{ ok: true, count: number }`

### GET `/geo/distribution`

省/市打卡分布 + 网格热力点（**DT5** 运营大屏）。

**Query**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `days` | number | 30 | 1～90；统计近 N 天已通过打卡 |

**响应 `data`**：`AnalyticsGeoDistribution`

| 字段 | 说明 |
|------|------|
| `provinces` | 省级打卡量（ECharts Geo 面名称） |
| `cities` | 城市级分布（含经纬度） |
| `heatPoints` | 0.1° 网格热力点 Top 200 |
| `scopeDays` | 请求的时间窗天数 |
| `effectiveScope` | `window` = 时间窗有数据；`allTime` = 时间窗无数据时回退全量 |
| `generatedAt` | ISO 生成时间 |

### GET `/geo/flows`

城际 OD 流动 Top N（**DT5**；同一用户相邻不同 `city_code` 打卡，出现次数 ≥ `ANALYTICS_MIN_FLOW_COUNT`）。

**Query**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `days` | number | 30 | 1～90 |
| `limit` | number | 20 | 1～50 |

**响应 `data`**：`AnalyticsGeoFlow[]` — 起终点城市码、名称、经纬度、`count`

### GET `/system-resources`

系统资源统计（远程 Git 浅克隆快照；**不扫**部署机本机业务工作区）。详见 [系统资源统计.md](./系统资源统计.md)。

**Query**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `refresh` | boolean | false | `1` / `true` 强制重新 fetch 远程并刷新内存缓存 |

**响应 `data`**：`SystemResourcesStats`

| 字段 | 说明 |
|------|------|
| `source` | 恒为 `git-remote` |
| `remoteUrl` / `branch` / `commitSha` / `commitAt` | 远程元信息（URL 已脱敏） |
| `packages` / `fileTypes` / `modules` / `plugins` / `docs` | HEAD 工作树存量分类 |
| `componentsByApp` / `pagesByApp` | 各端组件 / 页面数 |
| `commitTrends` | 浅克隆窗口内按日源码增删与估算总量 |
| `moduleChurn` | 窗口内按子包源码 churn |
| `overview` | 卡片用概览指标 |
| `generatedAt` | ISO 生成时间 |

**错误**：`api.systemResourcesGitFailed`（克隆/fetch 失败）· `api.systemResourcesFailed`（其它聚合失败）

---

## 20. 旅行宠物 pets

前缀：`/api/pets` — **H3-a～d**（领养 · 悬浮上下文 · 记忆墙 · AI 分析 · **行中 exp/庆祝**）

### POST `/adopt`

领养旅行伙伴（每用户仅一次）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `species` | string | 是 | `fox` / `cat` / `panda` |
| `nickname` | string | 是 | 1～64 字符 |
| `personality` | string | 是 | `guide` / `foodie` / `photo` / `family` |

**响应 `data`**：`TravelPetInfo`  
**错误**：已领养 → `409` + `PET_ALREADY_ADOPTED`

### GET `/me`

当前用户的旅行伙伴资料。

### PATCH `/me`

更新昵称或人格。

**Body**：`nickname?`、`personality?`（至少一项）

### GET `/me/floating-context`

H3-b 悬浮层上下文（宠物摘要 + Top-K 记忆 + 分析缓存提示），与规划 orchestrator 共用 `buildPlanPetMeta`。

### GET `/me/memories`

记忆墙分页列表。

**Query**：`page`、`pageSize`（见 §1.4）

**响应 `data`**：`{ items: PetMemoryWallItem[], total, page, pageSize }`

### POST `/me/memories`

确认写入 analyze 建议的记忆（最多 10 条）。

**Body**：`{ items: [{ memoryType, content, importance?, metadata? }] }`

### PATCH `/me/memories/:id`

置顶 / 取消置顶。

**Body**：`{ pinned: boolean }`

### DELETE `/me/memories/:id`

删除单条记忆。

### POST `/me/analyze`

宠物 AI 分析（H3-c / H3-d）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `scene` | string | 是 | `pre_plan` / `post_trip` / `on_demand` / **`in_plan`** / **`in_trip`** |
| `routeId` | number | 否 | 关联路线（行中/行后建议传） |
| `sessionId` | number | 否 | 关联规划会话 |

**响应 `data`**：`PetAnalyzeResult` — `insight`、`petReply`、`suggestedActions`、`memoriesToSave`、`cached`

**本地验收**：`pnpm --filter @douxing/server pet:adopt-cases` · `pet:memory-analyze-cases` · `h3-d:in-trip-cases` · `h5:m5-accept`

---

## 21. Agent Tools（内网）

> **用途**：`packages/ai-service` 的 `node_client.py` 回调 Node 执行确定性 Tool；**不对公网 C 端暴露**。  
> **鉴权**：请求头 `x-agent-tool-secret` 与 `.env` 中 `AGENT_TOOL_SECRET` 一致；开发环境未配置 secret 时 Node 放行。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agent/route-intent` | 追问意图路由（body: `{ message }` → `RoutedAgentIntent`） |
| GET | `/api/agent/tools` | 列出可用 Tool 名称 |
| POST | `/api/agent/tools/:name` | 执行指定 Tool |

**Tool 名称（`:name`）**

| name | 说明 |
|------|------|
| `parse_intent` | 结构化旅行意图 |
| `retrieve_attractions` | 景点 RAG 检索 |
| `retrieve_playbooks` | 玩法 Playbook 检索 |
| `generate_route_draft` | LLM 生成路线 draft |
| `enrich_route` | Enricher 增强住/行/班次 |
| `validate_route` | Zod + 规则校验（可选 autoFix） |
| `patch_route_day` | 局部修改某一天 POI |
| `tune_route_budget` | 按新预算校正 draft（Step 4） |
| `answer_food_qa` | 美食问答文案（不生成路线） |
| `select_plan_variant` | 解析方案字母并返回 routeId |
| `build_route_variants` | 生成 2～3 套候选方案（Step 13） |
| `apply_memory_context` | 记忆召回并注入规划 context（C7-c Step 26） |
| `recall_user_memory` | 召回 H3 宠物记忆 |
| `write_trip_memory` | 写入行程/偏好记忆 |
| `replan_segment` | GPS + 剩余 POI 行中重排（H8 Step 31） |
| `detect_missed_pois` | 应到未到 POI + 替补推荐（H7 Step 33） |

**响应**：与其它 API 一致 `{ code, message, data }`；Tool 业务数据在 `data` 内。

**关联**：Python `POST /v1/agent/plan`（见 `packages/ai-service/README.md`）；规划会话在 `AGENT_PLAN_ENABLED=true` 时间接使用 Agent 路径。

---

## 22. 静态资源 uploads

非 JSON API，Express 静态目录：

| 路径前缀 | 用途 |
|----------|------|
| `/uploads/avatars/` | 用户头像 |
| `/uploads/checkins/` | 打卡照片 |
| `/uploads/attractions/` | 景点封面 |
| `/uploads/photos/{userId}/` | 旅程相册照片（J1） |

生产环境用户照片也可存 OSS/CDN 完整 URL，不经过上述静态目录。

---

## 23. 附录：常用枚举

定义于 `@douxing/shared` 的 `constants.ts`：

| 枚举 | 值 | 说明 |
|------|-----|------|
| `RouteStatus` | 0/1/2 | 草稿 / 已发布 / 归档 |
| `MemberLevel` | 0～3 | 免费 / 白银 / 黄金 / VIP |
| `OrderStatus` | — | pending / paid / completed / cancelled |
| `CheckInStatus` | 0/1/2 | 待审 / 通过 / 拒绝 |
| `JourneyAlbumStatus` | active/archived | 相册状态 |
| `TravelPhotoSource` | upload/checkin/import | 照片来源 |
| `AnalyticsEventCategory` | business/behavior/system | 埋点分类 |
| `AnalyticsEventSource` | server/mobile/pc/web | 埋点来源端 |
| `DemandStatus` | draft/published/quoting/… | 需求单状态（`marketplace/constants`） |
| `BizOrgStatus` | pending/active/frozen | 商户组织状态 |
| `CertStatus` | pending/approved/rejected | 服务者认证状态 |
| `ServiceOrderStatus` | pending_pay/paid/… | 履约订单状态（与模块 A `orders` 分表） |

---

## 24. 管理端 AI 流程编排（admin）

> **权限**：均需登录且 `requirePerm('data:analytics:view')`（与数据分析、规划诊断页一致）。  
> **Web 页面**：`/plan-sessions/diagnostics` · `/workflow-templates` · `/workflow-templates/:id/editor`  
> **路线图**：[AI流程编排路线图.md](./AI流程编排路线图.md) · ADR：[adr/ADR-W5-1-visual-editor-vue-flow.md](./adr/ADR-W5-1-visual-editor-vue-flow.md)

### 24.1 规划诊断 · plan-sessions

前缀：`/api/admin/plan-sessions`

#### GET `/recent`

最近规划会话列表（诊断页选用）。

**Query**：`limit`（1～50，默认 20）

**响应 `data`**：`PlanSessionSummary[]`（含 `id`、`title`、`createdAt` 等摘要）

#### GET `/:sessionId/workflow-trace`

规划会话 **NodeSpan 时间线**（W0-5）。

**响应 `data`**：`PlanSessionWorkflowTrace`

| 字段 | 说明 |
|------|------|
| `sessionId` | 会话 ID |
| `generationPath` | `'agent'` \| `'pipeline'` |
| `lastRoutedIntent` | 最近路由意图 |
| `spans` | `AgentToolTraceEntry[]`（含 `nodeId`、RAG 命中、token、估算费用） |
| `totalDurationMs` | 各 span 耗时合计 |
| `langfuseSessionUrl` | 配置 Langfuse 时返回深链 |

#### GET `/:sessionId/cost-summary`

会话级 **token / 估算费用汇总**（W2-6）。

**响应 `data`**：`PlanSessionCostSummary` — 分节点、分模型 `estimatedCostCny` 合计

#### POST `/sandbox-run`

管理端 **沙箱模拟规划**（同步；以当前登录用户身份创建会话，**不写生产 routes 表**）。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `prompt` | string | 是 | 2～500 字 |
| `days` | number | 否 | 1～7 |
| `budget` | string | 否 | 预算描述 |
| `provider` | string | 否 | `auto` \| `douxing` \| `deepseek` \| `lmstudio` |
| `graphDefOverride` | object | 否 | W5：`WorkflowGraphDefinition` 覆盖运行时 DAG |

**响应 `data`**：`{ sessionId, generationSource, llmProvider, agentState }`

#### POST `/sandbox-run/async`

沙箱 **异步启动**：立即返回 `sessionId`，后台执行；客户端订阅 SSE 获取进度。

**Body**：同 `/sandbox-run`

**响应 `data`**：`{ sessionId }`

#### GET `/:sessionId/stream`

管理端规划沙箱 **SSE 流**（与 C 端 §8 事件格式一致，含 `node_status`）。

**鉴权**：`Authorization: Bearer` 或 query `?token=<JWT>`

**说明**：连接建立后会 `kickOffPendingAdminSandboxPlan` 触发挂起的异步沙箱；事件经 `plan-session-stream.service` 广播。

### 24.2 工作流模板 · workflow-templates

前缀：`/api/admin/workflow-templates`  
图 JSON 类型：`WorkflowGraphDefinition`（`schemaVersion: 1`，nodes + edges），校验见 shared `validateWorkflowGraph()`。

#### GET `/default-graph`

返回与 `plan_default.py` 主拓扑等价的 **参考 DAG**（`buildDefaultPlanDefaultGraph()`）。

#### POST `/validate-graph`

**Body**：`{ graphDef: WorkflowGraphDefinition }`

**响应 `data`**：校验结果（无环、必填边、Tool 节点合法等）

#### GET `/`

工作流模板分页列表。

**Query**：`page`、`pageSize`、可选筛选

#### POST `/`

创建模板。

**Body**：`id`（slug）、`nameZh`/`nameEn`、`selectionRules`（JSON Logic）、`nodeConfig`（topK/variantCount 等）、可选 `graphDef`

#### GET `/:id`

模板详情（含 `graphDef`、`graphPublishStatus`：`draft` \| `published`）

#### PUT `/:id`

更新模板字段（部分更新）

#### POST `/:id/publish-graph`

**Body**：`{ graphDef: WorkflowGraphDefinition }` — 校验通过后写入并标记 `published`

#### DELETE `/:id`

删除模板（预置 seed 模板受保护）

---

## 25. 发单接单 marketplace

> **模块 B** · **M0～M5 ✅** · **M6/E2 通道接线 ✅** · **M7-α/2c/3/4/5 ✅**（2026-07-15）· **M7-ext 评价与争议 ✅**（2026-07-16）· **MB4 通道预览**；完整商用待沙箱真机一笔  
> **产品**：[发单接单平台.md](./发单接单平台.md) · **路线图**：[发单接单路线图.md](./发单接单路线图.md)  
> **类型契约**：`@douxing/shared` → `marketplace/constants.ts`、`marketplace/types.ts`  
> **验收**：`m0`～`m7:marketplace-*-cases` + `m7-ext:marketplace-trust-cases`（见路线图 §6）；OpenAPI 全量同步仍为可选扫尾

前缀：`/api/marketplace`

与模块 A **分域**：不复用 `/api/routes`、`/api/orders`（路线解锁）；`service_demand.route_id` 为可选弱引用。

### GET `/health`

模块 B 健康检查（**无需登录**）。

**响应 `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 固定 `true` |
| `module` | string | 固定 `marketplace` |
| `timestamp` | string | ISO 8601 时间 |

### GET `/categories`

返回预置 **服务类目树**（**无需登录**）；展示文案通过 `labelKey` 走 i18n（如 `marketplace.category.travel`）。

**响应 `data`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `categories` | `ServiceCategoryNode[]` | 一级类目及 `children` 叶子节点 |

**`ServiceCategoryNode`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | 点分路径，如 `travel.custom_tour` |
| `labelKey` | string | i18n 键 |
| `children` | array? | 子类目 |

一级类目示例：`travel`（旅行服务）、`photo`（影像服务）、`talent`（人才服务）。

### GET `/demands/mine`

当前登录用户作为 **发单方** 创建的需求单列表（按 `createdAt` 倒序）。

**鉴权**：登录（`Authorization: Bearer`）

**响应 `data`**：`{ items: ServiceDemandSummary[] }`

**`ServiceDemandSummary` 主要字段**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 主键 |
| `demandNo` | string | 业务单号（`SD` 前缀） |
| `publisherType` | string | `user` / `group` |
| `publisherUserId` | number | 发单方用户 ID（操作者） |
| `publisherGroupId` | number? | 团体发单时的团体 ID；个人发单为 `null` |
| `headcount` | number? | 预计人数（1～100000）；未填为 `null` |
| `categoryCode` | string | 类目 code |
| `title` | string | 标题 |
| `destination` | string? | 目的地 |
| `startDate` / `endDate` | string? | `YYYY-MM-DD` |
| `budgetMin` / `budgetMax` | string? | 金额字符串 |
| `budgetType` | string? | `fixed` / `range` / `negotiable` |
| `status` | string | 见 §23 `DemandStatus` |
| `routeId` | number? | 可选关联模块 A 路线 |
| `createdAt` / `updatedAt` | string | ISO 时间 |

### GET `/demands/:id`

需求单详情；**发单方本人、团体成员**，或大厅公开状态（`published` / `quoting`）可查看。

**鉴权**：登录

**路径参数**：`id` — 需求单主键（正整数）

**响应 `data`**：`ServiceDemandDetail`（在 Summary 基础上增加 `description`、`invoiceInfo`）

**错误**

| 场景 | messageKey |
|------|------------|
| 不存在 | `api.marketplaceDemandNotFound` |
| 无权 | `api.marketplaceDemandForbidden` |
| 非法 ID | `api.paramError` |

### GET `/admin/orgs`

管理端 **商户组织列表**（M0 占位：返回库内全部 `biz_org`，含 seed 演示旅行社）。

**鉴权**：登录 + `requirePerm('marketplace:org:list')`

**响应 `data`**：`{ items: BizOrgSummary[] }`

**`BizOrgSummary`**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 主键 |
| `name` | string | 机构名称 |
| `orgType` | string | `travel_agency` / `photo_studio` / … |
| `licenseNo` | string? | 资质编号 |
| `status` | string | `pending` / `active` / `frozen` |
| `createdAt` | string | ISO 时间 |

**M0 暂不暴露**（见 [发单接单平台 §13.3](./发单接单平台.md#133-m0-明确不做留给-m1m2)）：以下为 **M0 时代**笔误保留说明；**M1/M2 已交付**写操作，见下表。

### M1～M7 / E2 API 速查（代码已落地 · OpenAPI 待全量同步）

| 分组 | 方法 | 路径 | 鉴权 | 阶段 |
|------|------|------|------|------|
| 入驻 | POST | `/orgs/apply` | 登录 | M1 |
| 入驻 | POST | `/orgs/documents/upload` | 登录 | M1 |
| 入驻 | GET | `/orgs/mine` · `/orgs/:id` | 登录 | M1 |
| 服务者 | POST | `/providers/apply` | 登录 | M1 |
| 服务者 | GET | `/providers/me` · `/providers/:id` | 登录/公开 | M1 |
| 平台审核 | GET/PATCH | `/admin/orgs/*` · `/admin/providers/*` | `marketplace:org:audit` 等 | M1 |
| 发单 | POST/PATCH | `/demands` · `/demands/:id` | 登录；body 可选 `publisherGroupId`（M3-2） | M2/M3-2 |
| 大厅 | GET | `/demands` | 登录 | M2 |
| 报价 | POST | `/demands/:id/quotes` | 登录（approved 服务方；团体成员不可报本团） | M2/M3-2 |
| 选定 | POST | `/demands/:id/select-quote` | 登录（发单方/团体成员） | M2/M3-2 |
| 报价列表 | GET | `/demands/:id/quotes` · `/quotes/mine` | 登录 | M2 |
| 订单 | GET | `/orders/mine` · `/orders/seller` · `/orders/:id` | 登录 | M2 |
| 履约 | POST/PATCH | `/orders/:id/pay-mock` · `/orders/:id/pay` · `/orders/:id/prepay` · `/orders/:id/status` | 登录 | M2/E2 |
| 支付回调 | POST | `/api/payments/wechat/notify` | 微信回调；按 `out_trade_no` 路由 `orders` 或 `service_order` | E2 |
| 监管 | GET | `/admin/demands` | `marketplace:demand:list` | M2 |
| 团体 | POST | `/groups` | 登录 | M3-1 |
| 团体 | GET | `/groups/mine` · `/groups/:id` | 登录（成员） | M3-1 |
| 团体 | PATCH/DELETE | `/groups/:id` | 登录（owner） | M3-1 |
| 团体成员 | POST | `/groups/:id/members` | 登录（owner） | M3-1 |
| 团体成员 | DELETE | `/groups/:id/members/:userId` | 登录（owner） | M3-1 |
| Partner | GET | `/partner/context` | 登录 + `merchant` | M7-α |
| Partner | POST | `/partner/enroll` | 登录 | M7-α |
| Partner | GET | `/partner/settlements` | 登录；须为该商户 owner/admin；query `orgId` 必填、`status` 可选 | M7-5 |
| Org | GET | `/orgs/:id/members` | 登录；须为该商户成员 | M7-3 |
| 订单 | PATCH | `/orders/:id/assign` | 登录；body `{ guideUserId }`（null 清除）；仅 seller org owner/admin | M7-3 |
| 订单 | GET | `/orders/:id/reports` | 登录；买方或卖方可读 | M7-4 |
| 订单 | POST | `/orders/:id/reports` | 登录；卖方侧；`in_progress`/`delivered`；body 签到或图文 | M7-4 |
| 订单 | POST | `/orders/:id/reports/photos` | 登录；卖方侧；上传汇报图片 | M7-4 |
| 评价 | GET | `/orders/:id/reviews` | 登录；订单相关方可读 | M7-ext |
| 评价 | POST | `/orders/:id/reviews` | 登录；订单相关方；`confirmed`/`delivered`/`completed` 后可写；body `rating`/`content` | M7-ext |
| 评价 | POST | `/orders/:id/reviews/:reviewId/reply` | 登录；评价对象方（卖方）可回复 | M7-ext |
| 争议 | GET | `/orders/:id/disputes` | 登录；订单相关方可读 | M7-ext |
| 争议 | POST | `/orders/:id/disputes` | 登录；买方/卖方；订单存在且非已结案；body `type`/`reason` | M7-ext |
| 管理端 | GET | `/admin/disputes` | 登录 + `marketplace:dispute:list`；query `keyword`/`status`/`page`/`pageSize` | M7-ext |
| 管理端 | PATCH | `/admin/disputes/:id` | 登录 + `marketplace:dispute:resolve`；body `status`/`platformNote` | M7-ext |

路由实现：`packages/server/src/routes/marketplace/*`；Web 商户页消费 Partner + 上述卖方 API。

### M7-4 履约汇报摘要

- 表 `service_order_report`（迁移 `0046`）：`checkin` / `report` · 可选地点坐标 · 多图 URL
- 卖方侧（含指派领队）可写；买方可读时间线
- Partner 订单详情内提交与展示

### M7-ext 履约评价与争议摘要

- 表 `service_order_review`（迁移 `0047`）：`fromUserId` / `toTargetType` (`buyer`/`seller`/`provider`/`org`) / `toUserId`/`toOrgId` / `rating` / `content` / `tags` / `replyContent` / `replyAt`
- 表 `service_order_dispute`（迁移 `0047`）：`initiatorUserId` / `respondentType` / `respondentUserId`/`respondentOrgId` / `type` / `reason` / `status` / `platformNote` / `resolvedAt`
- 订单状态 `confirmed`/`delivered`/`completed` 后可评价；同一订单同一目标方不可重复评价；评价对象方可回复
- 争议：订单相关方在 `confirmed`/`delivered`/`completed`/`disputed` 状态可发起；存在未结案争议时不可重复发起；平台仲裁后转入 `resolved_buyer`/`resolved_seller`/`closed` 并触发信用分扣减
- 管理端 `/marketplace/disputes` 仲裁；C 端/PC 订单详情发起评价与申诉；Partner 订单详情展示并回复

### M7-3 排期与指派摘要

- `service_order.assigned_guide_user_id` / `assigned_at`（迁移 `0045`）
- 指派对象须为本商户 `org_member`；订单须有 `seller_org_id`
- 订单详情回填 `demandStartDate` / `demandEndDate` 与领队展示名
- Partner：`/partner/schedule` 月视图 · 订单详情指派 UI

### M3-1 团体 CRUD 摘要

**鉴权**：均需登录（`Authorization: Bearer`）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/groups` | 登录 | 创建团体；创建者自动为 `owner` |
| GET | `/groups/mine` | 登录 | 当前用户所属团体列表 `{ items: GroupMembershipSummary[] }` |
| GET | `/groups/:id` | 成员 | 团体详情（含 `members`） |
| PATCH | `/groups/:id` | owner | 更新名称/类型/人数 |
| DELETE | `/groups/:id` | owner | 删除团体（成员 cascade） |
| POST | `/groups/:id/members` | owner | body `{ userId }` 邀请协作者 |
| DELETE | `/groups/:id/members/:userId` | owner | 移除协作者（不可移除 owner） |

**错误 messageKey（节选）**：`api.marketplaceGroupNotFound` · `api.marketplaceGroupForbidden` · `api.marketplaceGroupOwnerRequired` · `api.marketplaceGroupMemberAlreadyExists` · `api.marketplaceGroupCannotRemoveOwner`

### M3-2 团体发单摘要

**创建**：`POST /demands` body 增加可选 `publisherGroupId`（正整数）。

| 行为 | 说明 |
|------|------|
| 有 `publisherGroupId` | `publisher_type=group`；须为该团成员；`publisher_user_id`=操作者 |
| 无 `publisherGroupId` | 个人发单（与 M2 一致） |
| 更新/发布/选定报价 | 团体成员均可管理本团需求（不限创建者本人） |
| 报价 | 团体成员不可对本团需求报价 |

### M3-3 人数与发票摘要

**迁移**：`0041_marketplace_m3_demand_fields`（`service_demand.headcount` · `invoice_info`）

| 字段 | 说明 |
|------|------|
| `headcount` | 可选整数 1～100000；可传 `null` 清空 |
| `invoiceInfo` | JSON；`titleType`=`personal`/`company` · `title` 必填；**企业须 `taxNo`**；可传 `null` 清空 |

本阶段**仅存资料**，不做真开票。

**验收**：`pnpm --filter @douxing/server db:migrate` → `m3:marketplace-group-cases`

---

## 26. 精准化与人群定制 personalization

> **录入日期**：2026-07-17 · **专题**：[精准化与人群定制路线图.md](./精准化与人群定制路线图.md) · **状态**：待开发（P-TAG-01 / P-ONBOARD-01 / P-INPUT-01 / P-MEMORY-01 / P-THEME-01 / P-LIVE-01 / P-DEMAND-01 / P-PROFILE-01）

前缀：`/api/personalization`（部分复用 `/api/users`、`/api/attractions`、`/api/marketplace`）

### 26.1 标签体系

#### GET `/api/personalization/tag-taxonomy`

返回分类标签体系（供前端引导与选择器使用）。

**响应 `data`**：

```json
{
  "coreCategories": [
    {
      "id": "basic",
      "i18nKey": "personalization.tagCategory.basic",
      "subTags": [
        { "slug": "gender_male", "i18nKey": "personalization.tag.gender_male", "defaultValue": "男" },
        { "slug": "gender_female", "i18nKey": "personalization.tag.gender_female", "defaultValue": "女" }
      ]
    },
    { "id": "radius", "subTags": [{ "slug": "local" }, { "slug": "domestic" }, { "slug": "global" }] },
    { "id": "scene", "subTags": [{ "slug": "溜娃" }, { "slug": "约会" }, { "slug": "玩水" }] }
  ],
  "optionalCategories": [
    { "id": "interest", "subTags": [{ "slug": "culture" }, { "slug": "nature" }] },
    { "id": "companion", "subTags": [{ "slug": "solo" }, { "slug": "couple" }] }
  ],
  "defaults": { "gender": "prefer_not_to_say", "ageRange": "23-30", "travelRadius": "any", "preferredScenes": ["溜娃", "纳凉"] }
}
```

#### GET `/api/personalization/scenes`

场景标签列表（P-TAG-01），用于首页 chip 行与专题页。

**响应 `data`**：`{ slug, i18nKey, coverImageUrl, routeCount, attractionCount }[]`

### 26.2 首次进入引导（P-ONBOARD-01）

#### POST `/api/users/me/onboarding/complete`

提交引导选择（可跳过）；服务端用默认值填充未选字段，写入 `onboardedAt`，并刷新旅行人格。

**Body**（均可选）

| 字段 | 类型 | 说明 |
|------|------|------|
| `gender` | string | `male`/`female`/`other`/`prefer_not_to_say` |
| `ageRange` | string | `18-22`/`23-30`/`31-40`/`41-50`/`50+` |
| `travelRadius` | string | `local`/`domestic`/`global`/`any` |
| `preferredScenes` | string[] | 场景标签 slug 列表 |
| `interestTags` | string[] | 兴趣类型（复用现有中文预设） |
| `companionStructure` | string[] | `solo`/`couple`/`family`/`group` |
| `budgetTier` | string | `budget`/`mid-range`/`premium`/`luxury` |
| `skipped` | boolean | true 表示整页跳过，系统用默认值填充 |

**响应 `data`**：更新后的 `UserInfo`（含 `onboardedAt`，格式 `yyyy-mm-dd HH:mm:ss`）

> 说明：规划中的 `POST /onboarding/skip` 已合并为本接口 `skipped: true`，不再单独提供。

### 26.3 人群定制推荐（P-ONBOARD-01 §9.8 · 待实现）

#### GET `/api/recommendations/home`

首页个性化推荐（替代 `/routes/hot`）。

**Query**

| 字段 | 类型 | 说明 |
|------|------|------|
| `limit` | number | 默认 10 |
| `scope` | string | `routes`/`attractions`/`mixed`，默认 `mixed` |

**响应 `data`**：

```json
{
  "routes": [{ "id", "title", "coverImageUrl", "matchedScenes": ["溜娃"], "matchScore": 0.92 }],
  "attractions": [{ "id", "name", "coverImageUrl", "city", "matchedScenes": ["溜娃"], "matchScore": 0.88 }],
  "personaSnapshot": { "ageRange": "31-40", "preferredScenes": ["溜娃"] }
}
```

#### GET `/api/recommendations/scenes/:sceneSlug`

某场景专题页聚合推荐。

**响应 `data`**：`{ scene, attractions[], routes[], products[], demands[] }`

### 26.4 规划标签化定制（P-INPUT-01）

#### POST `/api/routes/generate-by-tags`

直接基于标签构建 `TravelIntentSnapshot` 发起规划（跳过 LLM 意图解析）。

**Body**

| 字段 | 类型 | 说明 |
|------|------|------|
| `city` | string | 目的地城市 |
| `days` | number | 天数 |
| `budgetMin` / `budgetMax` | number | 预算区间 |
| `themes` | string[] | 兴趣类型 slug |
| `scenes` | string[] | 场景标签 slug |
| `headcount` | number | 人数 |
| `companionStructure` | string[] | 同伴结构 |
| `transportPreference` | string | 大交通偏好 |
| `lodgingTier` | string | 住宿档次 |
| `startDate` | string | ISO 日期 |

**响应**：同 `POST /api/routes/generate`，但 `intentSnapshot.source='manual'`

### 26.5 已去景点避重（P-MEMORY-01）

#### GET `/api/users/me/visited-attractions`

返回用户已去过景点列表（来自 `check_ins` + `travel_routes` + `pet_memories.regret`）。

**Query**：`?includePlanned=true` 是否包含仅规划未打卡的

**响应 `data`**：`{ attractionId, name, source: 'checkin'|'planned'|'regret', visitedAt }[]`

#### PUT `/api/users/me/avoid-repeat-strategy`

设置避重策略。

**Body**：`{ strategy: 'strict'|'soft'|'off', manualAvoidAttractionIds: number[], allowRepeatAttractionIds: number[] }`

### 26.6 景点实时人数（P-LIVE-01）

#### GET `/api/attractions/:id/live-visitor`

**响应 `data`**：

```json
{ "level": 2, "levelLabel": "适中", "trend": "up", "updatedAt": "2026-07-17 09:30:00", "estimatedCount": null }
```

- `level`：0 稀疏 / 1 适中 / 2 密集 / 3 旺季
- `estimatedCount`：仅当计数 ≥ 阈值（默认 5）时返回数字，否则 null

### 26.7 单景点需求（P-DEMAND-01）

复用 `/api/marketplace/demands`，新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `demandScene` | string | `custom`（默认）/ `single_poi` / `same_city_day` |
| `targetAttractionId` | number | 单景点需求的景点 ID |
| `targetDate` | date | 单日需求的目标日期 |

**新增筛选**：`GET /api/marketplace/demands?demandScene=single_poi&targetAttractionId=10&targetDate=2026-07-17`

### 26.8 群体主题（P-THEME-01）

#### GET `/api/personalization/themes`

返回可用主题列表。

**响应 `data`**：`{ id, i18nKey, primaryColor, previewImageUrl, recommendedFor: { ageRange, gender } }[]`

#### PUT `/api/users/me/preferred-theme`

**Body**：`{ themeId: 'blue'|'teal'|'kids'|'pink'|'tech'|'mature' }`

#### GET `/api/users/me/recommended-theme`

根据画像自动推荐主题（用户可覆盖）。

**响应 `data`**：`{ themeId, reason: 'based_on_age_range_and_gender' }`

### 26.9 隐私合规

- 所有画像字段写入与修改须记录审计日志
- `GET /api/users/me/privacy-report` 返回画像字段使用情况
- `DELETE /api/users/me/persona` 一键清除画像重置为默认

---

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-07-17 | **P-ONBOARD-01**：落地 `POST /users/me/onboarding/complete`；`PUT /users/me` 扩展 gender/ageRange/travelRadius/companionStructure/budgetTier；UserInfo 含 onboardedAt |
| 2026-07-17 | **精准化与人群定制 API 录入**：新增 §26 `/api/personalization/*` · `/api/recommendations/*` · `/api/users/me/onboarding` · `/api/users/me/visited-attractions` · `/api/attractions/:id/live-visitor` · `/api/users/me/preferred-theme` 等；关联 [精准化与人群定制路线图.md](./精准化与人群定制路线图.md) · ROADMAP §9.10 |
| 2026-07-15 | **文档全量同步**：文首/§25 状态对齐路线图 v1.11.0（E2 接线 ✅ · 下一沙箱真机） |
| 2026-07-16 | **M7-ext 评价与争议**：§25 增 reviews / disputes / admin/disputes API；迁移 `0047`；`m7-ext:marketplace-trust-cases` |
| 2026-07-16 | **A-CLOSE-01 路线一键发定制需求**：路线详情新增入口 → 发单页带出 `routeId`/`title`/`destination`/`budgetMin`/`budgetMax`/`description`（含关键 POI）；`m2-ext:route-to-demand-cases` |
| 2026-07-16 | **A-COGNITION-01 统一旅行画像**：新增 `user_travel_persona` 表 + 聚合 Service；`GET /users/me/persona` + `POST /users/me/persona/refresh`；规划注入 `personaSummary` → `constraintSummary`；迁移 `0048`；`a-cognition:user-persona-cases` |
| 2026-07-15 | **E2 微信通道接线**：§25 增 `prepay` · notify 双表路由 · C 端对齐 |
| 2026-07-15 | **M7-4 履约汇报**：§25 增 reports API；迁移 `0046` |
| 2026-07-15 | **M7-3 排期指派**：§25 增 `GET /orgs/:id/members` · `PATCH /orders/:id/assign`；迁移 `0045` |
| 2026-07-15 | **M7-5 Partner 财务 UI**：§25 增 `GET /partner/settlements`；Web `/partner/settlements` |
| 2026-07-14 | **M3-3 人数与发票**：§25 增 `headcount` / `invoiceInfo`；迁移 `0041`；验收 `m3:marketplace-group-cases` |
| 2026-07-14 | **M3-2 团体发单**：§25 增 `publisherGroupId` · 团体成员权限 · 防自报价；验收 `m3:marketplace-group-cases` |
| 2026-07-14 | **M3-1 团体**：§25 增 `/groups/*` CRUD 与成员邀请；验收 `m3:marketplace-group-cases` |
| 2026-07-13 | **M7-α Partner**：§25 增 M1/M2/M7-α API 速查表 · `GET/POST /partner/*`；MB2 ✅ 状态同步 |
| 2026-07-17 | **系统资源统计**：§19 增 `GET /system-resources`；总览 **126** 项；专题 [系统资源统计.md](./系统资源统计.md)；OpenAPI 同步 |
| 2026-07-10 | **M0 发单接单**：§25 `/api/marketplace/*`（5 个 GET）；§23 增 marketplace 枚举；总览 **125** 项；OpenAPI **103** 路径 / **122** 操作 |
| 2026-07-09 | **C7-W**：§24 管理端 `admin/plan-sessions`（6 项）+ `admin/workflow-templates`（8 项）；§8 SSE 增 `node_status` 与 `tool_call.nodeId`；总览 **120** 项；OpenAPI **98** 路径 / **117** 操作 |
| 2026-07-07 | **双 Token**：§4 增 `POST /refresh` · `POST /logout`；`LoginResult` 增 `refreshToken` · `expiresIn`；总览认证项 +2（见 §2）；专题 [双Token认证与无感刷新.md](./双Token认证与无感刷新.md) |
| 2026-07-03 | **H10 + I3**：路线评论 dayIndex/attractionId · `route_media` CRUD · 视频审核 API · llm-status 增 douxing 字段；总览 **106** 接口 |
| 2026-07-01 | **DT5**：§19 增 `GET /geo/distribution` · `GET /geo/flows`；`AnalyticsGeoDistribution` 含 `scopeDays` / `effectiveScope`；总览 **101** 接口 |
| 2026-06-26 | **DT2/DT3**：§19 增 `GET /funnel` · `POST /events/batch`；埋点写入改为登录可选；总览 **99** 接口 |
| 2026-06-18 | **M5 行中**：§7 新增 `replan/preview` · `replan/apply` · `missed-pois/*`；§20 `analyze` 增 `in_plan`/`in_trip`；§21 Agent Tool 增 `replan_segment` · `detect_missed_pois` · `apply_memory_context` · `build_route_variants`；总览 **97** 接口 |
| 2026-06-18 | 新增 §20 旅行宠物 `/api/pets/*`（9 个接口）；修正总览序号；总览 **93** 接口 |
| 2026-06-10 | J5++：`DELETE /journey-albums/:id`；路线列表 `listCoverImageUrl`；总览 **83** 接口 |
| 2026-06-10 | J5：`share`、`apply-exif-suggestions`、`GET /share/journey-albums/:token`；总览 **82** 接口 |
| 2026-06-10 | J5+：`shootingParams` 字段；客户端同参数拼图 · 我的相册选路线上传 |
| 2026-06-10 | 旅程相册补全 `by-route`、`/photos`；用户 `GET /me/storage` |
| 2026-06-09 | 新增 §19 数据分析 `/api/analytics/*`（4 个接口）；OpenAPI 同步 |
| 2026-06-09 | 初版：汇总全项目 REST 接口 + 静态资源说明；含 J1 旅程相册 |

---

**维护约定**：新增或变更 `packages/server/src/routes/**` 时，请同步更新：

1. 本文档 §2 总览表与对应章节  
2. **[openapi.yaml](./openapi.yaml)**（Apifox 导入源）
