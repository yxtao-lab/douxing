# AI 旅行宠物（H3 线）

> **录入日期**：2026-06-10  
> **定位**：用户 **专属 AI 旅行伙伴**——全系统可悬浮、可动、可交互；具备 **AI 分析** 与 **结构化记忆**；与 **路线规划（C 线）独立模块、同一主链路深度耦合**。  
> **路线图编号**：**H3-a～H3-e**（见 [ROADMAP.md § H3](./ROADMAP.md#h3-ai-旅行宠物2026-06-10-录入)）  
> **AI 规划路线图 Step**：**Step 25～34 → 里程碑 M4/M5**（见 [AI路径规划路线图.md §1 Phase 4～5](./AI路径规划路线图.md#phase-4--c7-c--h3记忆与规划页宠物p1)）  
> **当前状态**：**H3-a～d 已验收**（2026-06-18）：领养 API · 悬浮层 · 记忆墙/analyze · **行中 exp/庆祝/in_trip** · **M5 达成**。H3-e 向量记忆待 M6。**文档同步**：2026-06-23。

---

## 1. 产品目标

| 用户痛点 | 兜行解法 |
|----------|----------|
| AI 规划像工具，用完即走，没有「我的」感 | **专属宠物**：固定身份、长期陪伴、跨多次行程 |
| 每次规划都要重复说偏好 | **记忆层**：自动记住城市、节奏、预算习惯、遗憾 POI |
| 规划、行中、行后体验割裂 | **全站悬浮层** + 分场景 **AI 分析**（规划前/中/行中/行后） |
| 打卡/成就只有数字，缺少情感反馈 | 宠物 **成长、心情、庆祝动画**，与徽章/打卡联动（衔接 H4） |

**一句话**：**规划负责「算清楚去哪」；宠物负责「记住你是谁、陪你看世界」。**

### 1.1 与路线规划的关系

| 维度 | 路线规划（C 线） | AI 旅行宠物（H3 线） |
|------|------------------|----------------------|
| 本质 | 工具：需求 → 可执行行程 | 伴侣：情感 + 记忆 + 个性化 |
| 模块 | `plan_sessions`、Enricher、路线 CRUD | `travel_pets`、`pet_memories`、分析服务 |
| 入口 | 规划 Tab / 主 CTA | 全站悬浮 + 规划页 Focus 态 |
| 可否独立 | ✅ 可关闭宠物，规划全功能保留 | ❌ 无规划/打卡数据则价值弱 |

**产品决策**：**两个产品能力、一套用户旅程**——不合并为一个功能名，不拆成无关的两个 App。

---

## 2. 能力架构

```text
┌─────────────────────────────────────────┐
│  UI：TravelPetFloatingLayer（全站悬浮）   │
├─────────────────────────────────────────┤
│  认知：AI 分析（pre_plan / in_plan / …）  │
├─────────────────────────────────────────┤
│  记忆：短期上下文 + 长期结构化记忆        │
├─────────────────────────────────────────┤
│  数据：路线 / 打卡 / 相册 / 规划对话      │  ← 已有
└─────────────────────────────────────────┘
```

### 2.1 四层能力

| 层 | 含义 | 用户感知 |
|----|------|----------|
| **形象** | Lottie / 精灵图 / 物种模板 | 首页、规划、打卡时有「伙伴」 |
| **人格** | 语气、专长（美食/亲子/摄影…） | 说话像「我的」向导，非通用客服 |
| **记忆** | 偏好、行程摘要、遗憾、里程碑 | 「你上次成都没吃到火锅，这次补一家？」 |
| **成长** | 等级、心情、皮肤、技能 | 打卡越多越「懂我」 |

### 2.2 与现有能力关系

```text
users.interestTags（用户自填）
       │
       ├── travel_pets（新）← 领养、人格、等级、皮肤
       │         │
       │         ├── pet_memories（新）← 结构化长期记忆
       │         └── pet_trip_states（新，可选）← 行中绑定 route_id
       │
plan_sessions / plan_session_messages
       │  短期上下文；规划结束 → 写 trip_summary 记忆
       │
check_ins / badges / achievements（B 线）
       │  打卡/解锁 → 宠物 exp、milestone 记忆
       │
journey_albums / travel_photos（J 线）
       │  行后分析、照片主题（H3-d 二期）
       │
ai-service + llm-client（C 线）
       │  Pet Context 注入；analyze 独立短 prompt
       │
H7 错过景点 / H8 实时重规划
       └── regret 记忆、行中气泡提醒
```

| 已有 | H3 线扩展 |
|------|-----------|
| C1 `plan_sessions` 多轮规划 | 注入宠物 profile + Top-K 记忆；回复带 `petMeta` |
| `plan-messages.ts` 助手文案 | 扩展 `pet.*` i18n；宠物口吻与分析卡片 |
| `DouxingTabBar` + `AiPlanBlockingOverlay` | 同级挂载 `TravelPetFloatingLayer` |
| B4～B6 徽章/成就 | 解锁触发 milestone 记忆 + 庆祝动画 |
| J1～J5 旅程相册 | 行后复盘输入；远期照片主题分析 |
| I 线专属模型 | LoRA 微调「宠物口吻 + 兜行领域」 |

---

## 3. 全站悬浮与交互

### 3.1 交互分层

| 层级 | 名称 | 行为 |
|------|------|------|
| **L1** | Ambient（默认） | 右下角可拖拽浮球；待机动画； occasional 短气泡 |
| **L2** | 轻交互 | 点击 → 半屏 Sheet：今日洞察、快捷入口、摸头（仅 mood） |
| **L3** | 深交互 | 规划页 Focus 放大；打卡成功全屏庆祝 1.5s |

### 3.2 按页面显示策略

| 页面 | 悬浮 | 说明 |
|------|------|------|
| Tab 页（首页/规划/路线/我的） | ✅ L1～L3 | z-index 低于全屏遮罩（`AiPlanBlockingOverlay` 100000） |
| 路线详情 / 行中 | ✅ | 下一 POI 气泡；接 H7/H8 |
| 打卡地图 | ⚠️ | 原生 `<map>` 上用 `cover-view` 或地图外底栏；可缩小/隐藏 |
| 登录 / 分享只读页 | ❌ | 未登录不展示 |
| 手帐 Canvas / 海报导出 | ❌ | 避免入镜 |

### 3.3 挂载方式（移动端）

- **`App.vue`** 或统一 **`PageLayout`** 挂载全局唯一 `TravelPetFloatingLayer`
- 状态：`usePetCompanion()` composable（位置、心情、隐藏、当前 routeId）
- Tab 页可参考现有 `DouxingTabBar` 内嵌 `AiPlanBlockingOverlay` 的模式
- **PC 用户端**（`:5176`）：右下角 fixed，逻辑共用 `@douxing/shared`

### 3.4 简洁模式

设置项「显示旅行伙伴」默认开启；关闭后全站不渲染浮层，**不影响规划主功能**。

---

## 4. 记忆功能

### 4.1 记忆分类

| 类型 | 内容 | 来源 | 寿命 |
|------|------|------|------|
| **短期上下文** | 当前会话、进行中路线、今日 POI | `plan_sessions`、`route_id` | 会话/行程结束归档 |
| **长期结构化记忆** | 偏好、习惯、遗憾、里程碑 | 对话摘要、打卡、分析任务 | 持久，可衰减/合并 |
| **画像记忆** | 稳定标签 | `interestTags` + AI 推断 | 写回 `travel_pets.profile_json` |

### 4.2 `memory_type` 枚举（建议）

| 类型 | 示例 |
|------|------|
| `preference` | 偏爱美食 / 慢节奏 / 亲子 |
| `trip_summary` | 2026-05 成都 3 天，火锅 + 宽窄巷子 |
| `poi_feedback` | 武侯祠太挤，下次避开 |
| `regret` | 计划去都江堰但未打卡（接 H7） |
| `milestone` | 首次解锁「蓉城行者」徽章 |
| `budget_habit` | 预算常选 2000–4000 |
| `companion_note` | 宠物口吻一句话，用于气泡展示 |

**原则**：不存全量聊天记录；**LLM 摘要 → 结构化 JSON** 写入；展示层 i18n 渲染。

### 4.3 写入时机

- 规划会话结束 / 路线发布 → `trip_summary`
- 用户明确反馈（「太贵」「不想走路」）→ `preference`
- 打卡 / 徽章解锁 → `milestone`
- H7 识别应到未到 → `regret`
- 分析任务产出且用户确认 → 各类记忆（可选「是否记住」确认框）

### 4.4 检索策略（MVP）

规划或分析前：

1. `users.interestTags` + `travel_pets.personality_json` + `profile_json`
2. `SELECT` Top 5～8 条 `pet_memories`（`importance DESC`, `updated_at DESC`）
3. 若 `intent.city` 已知，优先同城 / 同标签记忆
4. 拼成 **「宠物已知关于你的事」** 块注入 prompt

**二期**：embedding 向量检索（复用景点 RAG 同一 Redis/检索模式）。

---

## 5. AI 分析功能

「分析」= 读数据 → 产出洞察 → 驱动宠物话术 / 建议 / 规划约束；**不是**全站 24h 自由聊天。

### 5.1 场景矩阵

| 场景 | `scene` | 输入 | 产出 | 用户可见 |
|------|---------|------|------|----------|
| 规划前 | `pre_plan` | 记忆 + 标签 + 历史路线 | 方向建议 | 浮球气泡 |
| 规划中 | `in_plan` | intent + 候选方案 | 风险/优化对比 | 规划页宠物旁 |
| 发布后 | `post_publish` | `route_detail` | 强度/预算/主题洞察 | 档案「洞察卡片」 |
| 行中 | `in_trip` | GPS + 计划 POI + 打卡 | 偏离、遗漏、替补 | 气泡（H7/H8） |
| 行后 | `post_trip` | 轨迹 + 相册 | 复盘 + 待写入记忆 | 记忆墙 / 庆祝 |
| 按需 | `on_demand` | 用户点击「分析一下」 | 综合洞察 | Sheet |

### 5.2 成本控制

| 频率 | 策略 |
|------|------|
| 高（待机浮球） | 规则 + 模板，**不调 LLM** |
| 中（进规划、发布路线） | 短 prompt 摘要 |
| 低（行后复盘、月度报告） | 完整 LLM 分析 |

分析结果 **Redis 缓存 5～30 分钟**，避免切页重复调用。

### 5.3 Prompt 结构（Pet Context）

在 `ai-service` / Node LLM 的 system prompt 之外增加块（与路线 JSON 规则分离）：

```text
【宠物身份】名称 / 性格 / 物种
【关于主人的记忆】（仅事实，勿编造）- memory_1 …
【本次分析任务】按 scene 切换说明
【输出】路线 JSON 不变；另返回 petInsight / memoriesToSave（或走独立 analyze API）
```

---

## 6. 数据模型（草案）

> **2026-06-16 已迁移**：`drizzle/0028_travel_pets.sql`；实现见 `packages/server/src/db/schema/travel-pets.ts`、`pet-memories.ts`、`pet-memory.service.ts`。

### 6.1 `travel_pets`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int PK | |
| `user_id` | int FK UK | 1 用户 1 宠（MVP） |
| `species` | varchar(32) | 物种模板，默认 `fox` |
| `nickname` | varchar(64) | 用户起名，默认「小兜」 |
| `personality` | varchar(32) | 人格，默认 `guide` |
| `level` | int | 等级，默认 1 |
| `exp` | int | 经验 |
| `mood` | varchar(16) | 心情，默认 `happy` |
| `created_at` / `updated_at` | timestamp | |

> 设计稿中的 `personality_json` / `profile_json` / `avatar_skin_key` 等字段 **二期** 再扩展；当前为扁平列 MVP。

### 6.2 `pet_memories`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | int PK | |
| `user_id` / `pet_id` | int FK | |
| `memory_type` | varchar(32) | `preference` · `trip_summary` · `regret` · `visited` · `milestone` 等 |
| `content` | text | 记忆正文（展示层 i18n 渲染） |
| `metadata` | json nullable | 结构化扩展 |
| `importance` | tinyint | 1～10，默认 5 |
| `created_at` / `updated_at` | timestamp | |

**已实现服务**：`ensureTravelPet`、`recallUserMemory`、`writeTripMemory`；Agent Tool 见 [AI规划与Agent演进.md §9](./AI规划与Agent演进.md#9-tool-清单与代码映射)。**后续 Step 25～30** 见 [AI路径规划路线图.md](./AI路径规划路线图.md)。

### 6.3 `pet_trip_states`（可选 · 行中）

| 字段 | 类型 | 说明 |
|------|------|------|
| `pet_id` / `route_id` | int FK | |
| `phase` | enum | `planning` / `on_trip` / `post_trip` |
| `last_lat` / `last_lng` | decimal nullable | |
| `today_mood_event` | varchar nullable | |
| `updated_at` | timestamp | |

### 6.4 `pet_analyze_logs`（可选 · 审计/配额）

记录 `scene`、`input_snapshot_json`、`output_json`、`provider`、`tokens`、`created_at`。

---

## 7. API 草案

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/pets/adopt` | 领养（species + nickname + 初始 personality） |
| GET | `/pets/me` | 当前宠物 + 成长摘要 |
| PATCH | `/pets/me` | 改名、换人格 |
| GET | `/pets/me/floating-context` | H3-b 悬浮层上下文 |
| GET | `/pets/me/memories` | 记忆墙（分页；可删、可 pin） |
| POST | `/pets/me/memories` | 确认写入 analyze 建议的记忆 |
| PATCH | `/pets/me/memories/:id` | 置顶 / 取消置顶 |
| DELETE | `/pets/me/memories/:id` | 用户删除记忆 |
| POST | `/pets/me/analyze` | body: `{ scene, routeId?, sessionId? }` → insight + petReply + suggestedActions |

**规划集成**：`GET/POST /plan-sessions/*` 响应可选带 `petMeta`（`mood`、`petReply`、`expGained`），减少前端往返。

所有用户可见文案走 **`pet.*` i18n**；API 错误/成功走 **`ApiMessageKey`**（见 [国际化.md](./国际化.md)）。

---

## 8. 分 Phase 实施（H3-a～H3-e）

| 步 | 名称 | 记忆 | AI 分析 | UI | 依赖 | 状态 |
|----|------|------|---------|-----|------|------|
| **H3-a** | 领养 + 规划人格化 | 表 + memory Tool | Agent 图内召回 | `PlanPetFocusCard` | C1、C7-c | ✅ |
| **H3-b** | 全站悬浮 L1/L2 | 对话抽 preference | — | `TravelPetFloatingLayer` | H3-a | ✅ |
| **H3-c** | 分析 API + 记忆墙 | 用户确认写入 | `pre_plan` / `post_trip` | 档案记忆墙 | H3-b | ✅ |
| **H3-d** | 成长 + 游戏化 | milestone；regret（H7） | `in_plan` / `in_trip` | 打卡庆祝 | H3-c、B、H7/H8 | ✅ M5 |
| **H3-e** | 专属模型 + 向量记忆 | embedding 检索 | 月度「旅行 DNA」 | Lottie | I、H3-d | ⏳ Step 35+ |

**推荐顺序**：`H3-a → H3-b → H3-c → H3-d → H3-e`（**H3-d 已随 M5 验收**）。  
**启动建议**：**H3-e** 与 I2/I3 对齐；与 **H4 旅行游戏化** 在 H3-d 汇合，可并行设计。

---

## 9. 验收清单

- [x] zh-CN / en-US 切换后：宠物文案、分析卡片、记忆墙无硬编码
- [x] API 错误/成功随 `Accept-Language` 变化
- [x] 关闭「简洁模式」后全站无浮层，规划/路线功能完整
- [x] 打卡地图页不遮挡 map 操作（隐藏或 cover-view 降级）
- [x] 规划 JSON 输出规则不受宠物 prompt 破坏
- [x] 用户可删除错误记忆；analyze 可审计

---

## 10. 相关文档

| 文档 | 用途 |
|------|------|
| [ROADMAP.md § H3](./ROADMAP.md#h3-ai-旅行宠物2026-06-10-录入) | 步骤状态与排期 |
| [国际化.md](./国际化.md) | `pet.*` / `ApiMessageKey` |
| [旅行照片存储系统.md](./旅行照片存储系统.md) | J 线行后分析输入 |
| [阿里云-兜行专属模型训练与部署.md](./阿里云-兜行专属模型训练与部署.md) | H3-e 口吻微调 |
| [公共组件.md](./公共组件.md) | 悬浮层组件登记（实施后更新） |
