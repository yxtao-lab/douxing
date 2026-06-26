# 兜行 API 接口文档

> **版本**：与代码同步（含 C7 Agent · H3 旅行宠物 · **M5 行中 H7/H8** · J1～J5+ 旅程相册）  
> **更新日期**：2026-06-23  
> **AI 规划执行顺序**：[AI路径规划路线图.md](./AI路径规划路线图.md)（当前 **Step 35** · **M1～M5 已验收**）  
> **服务包**：`packages/server`（Express + MySQL）  
> **类型契约**：`@douxing/shared`（`types.ts`、`constants.ts`）

---

## Apifox 导入（推荐）

接口定义以 **OpenAPI 3.0** 机器可读文件为准，可直接导入 Apifox：

| 文件 | 说明 |
|------|------|
| **[openapi.yaml](./openapi.yaml)** | 全量 **97** 个 REST 接口，含参数、Schema、JWT 鉴权 |

**导入步骤**

1. 打开 Apifox → 选择目标项目  
2. **项目设置** → **导入数据**（或左上角 **导入**）  
3. 格式选 **OpenAPI** / **Swagger**  
4. 选择本仓库 `docs/openapi.yaml`（或拖入文件）  
5. 导入后检查 **环境变量**：将 `servers` 中的 `http://localhost:3000` 设为当前环境  
6. 在 **Auth / 鉴权** 中配置：`Bearer Token`，值来自 `POST /api/auth/login` 返回的 `data.token`

**Apifox 环境建议**

| 变量名 | 示例值 | 用途 |
|--------|--------|------|
| `baseUrl` | `http://localhost:3000` | 与 OpenAPI `servers.url` 一致 |
| `token` | `eyJhbG...` | 登录后 JWT，用于 `Authorization: Bearer {{token}}` |

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
| `Authorization` | 需登录接口：`Bearer <JWT>` |
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
| 登录 | 需有效 JWT |
| 管理员 | 需 JWT 且角色含 `admin` |

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
| 7 | GET | `/api/auth/me` | 登录 | 认证 |
| 8 | GET | `/api/users/me` | 登录 | 用户 |
| 9 | PUT | `/api/users/me` | 登录 | 用户 |
| 10 | GET | `/api/users/me/membership` | 登录 | 用户 |
| 11 | GET | `/api/users/me/storage` | 登录 | 用户 |
| 12 | POST | `/api/users/me/avatar` | 登录 | 用户 |
| 13 | GET | `/api/attractions` | 公开 | 景点 |
| 14 | GET | `/api/attractions/cities` | 公开 | 景点 |
| 15 | GET | `/api/attractions/:id` | 公开 | 景点 |
| 16 | GET | `/api/attractions/admin/pending` | 管理员 | 景点 |
| 17 | GET | `/api/attractions/admin/catalog` | 管理员 | 景点 |
| 18 | POST | `/api/attractions/admin/:id/cover` | 管理员 | 景点 |
| 19 | POST | `/api/attractions/admin/:id/cover/refresh-amap` | 管理员 | 景点 |
| 20 | POST | `/api/attractions/admin/:id/approve` | 管理员 | 景点 |
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
| 88 | POST | `/api/analytics/events` | 管理员 | 数据分析 |
| 89 | POST | `/api/pets/adopt` | 登录 | 旅行宠物 |
| 90 | GET | `/api/pets/me` | 登录 | 旅行宠物 |
| 91 | PATCH | `/api/pets/me` | 登录 | 旅行宠物 |
| 92 | GET | `/api/pets/me/floating-context` | 登录 | 旅行宠物 |
| 93 | GET | `/api/pets/me/memories` | 登录 | 旅行宠物 |
| 94 | POST | `/api/pets/me/memories` | 登录 | 旅行宠物 |
| 95 | PATCH | `/api/pets/me/memories/:id` | 登录 | 旅行宠物 |
| 96 | DELETE | `/api/pets/me/memories/:id` | 登录 | 旅行宠物 |
| 97 | POST | `/api/pets/me/analyze` | 登录 | 旅行宠物 |

> 注：`/api/system/*` 等管理端接口见 [系统管理.md](./系统管理.md)，未纳入上表 97 项（C 端 + 数据分析主链）。

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

### POST `/register`

用户名密码注册。

**Body**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 3～32 字符 |
| `password` | string | 是 | 6～64 字符 |
| `nickname` | string | 否 | 昵称 |

**响应 `data`**：`LoginResult` — `{ token, user: UserInfo }`

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

### GET `/me`

当前登录用户（含角色）。

**响应 `data`**：`UserInfo`

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

---

## 7. 路线 routes

前缀：`/api/routes`

### GET `/llm-providers`

可选 LLM 提供商列表。

**响应 `data`**：`{ options: [...] }`

### GET `/llm-status`

检测 DeepSeek / LM Studio / ai-service 可用性。

### POST `/generate`

一句话生成路线（单轮，无会话）。

**Body**

| 字段 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 旅行需求，≥ 2 字 |
| `days` | number | 可选，1～7 |
| `budget` | string | 可选 |
| `provider` | string | `auto` \| `deepseek` \| `lmstudio` |

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

评论列表。**Query**：`limit`（默认 50）

### POST `/:id/comments`

发表评论（仅广场公开路线）。

**Body**：`{ content: string }` — 1～500 字

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
| `tool_call` | `{ tool, status: 'running'\|'done'\|'failed', ms? }` | Tool 进度；`tool` 对应 shared `agent.status.*` |
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

前缀：`/api/analytics`（均需 **管理员** JWT）。指标口径与分阶段路线见 [数据中台.md](./数据中台.md)。

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

---

## 变更记录

| 日期 | 说明 |
|------|------|
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
