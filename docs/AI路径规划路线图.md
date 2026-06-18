# AI 路径规划路线图

> **定位**：模块 A「AI 智能规划」的 **专项路线图** —— 只回答「**现在做什么 → 下一步做什么 → 全部验收完成**」。  
> **设计全稿**：[AI规划与Agent演进.md](./AI规划与Agent演进.md) · **全站索引**：[ROADMAP.md](./ROADMAP.md)

**文档版本**：3.0  
**最后更新**：2026-06-18

---

## 0. 当前指针（必读）

### 0.1 现在最推荐做什么

> **下一项工作：Step 29 — H3-c 记忆墙 / analyze**

| 项 | 内容 |
|----|------|
| **做什么** | `POST /pets/me/analyze` · 记忆墙 UI |
| **功能作用** | 用户可查看历史记忆与分析 |
| **完成标准** | 见 Phase 4 Step 29 |
| **完成后** | Step 30 C7-c + H3 阶段验收 |

**Step 28 已达成（2026-06-18）**：`TravelPetFloatingLayer` · `GET /pets/me/floating-context` · `travel-pet-floating:cases` 全绿。

**Step 27 已达成（2026-06-18）**：mobile + PC `PlanPetFocusCard` · `plan-pet-focus:cases` 全绿。

### 0.2 整体进度

```text
[████████████████████░] 约 87%  —  M0 + M1 + M2 + M3 已达成；Phase 4 Step 25 完成

当前阶段：Phase 4 · C7-c + H3 记忆与宠物
下一里程碑：M4 — Step 26～30
最终目标：M6 — 路线图全部 Step 验收（见 §2.2）
```

### 0.3 三条原则（执行过程中不可违背）

1. **每步必须先验收再进下一步** —— 勾选 §2.3 对应 Step 的验收项。
2. **`AGENT_PLAN_ENABLED=false` 时现网行为不变** —— 任何 Agent 改动不得破坏管道。
3. **确定性数据（交通/票价/POI）走 Tool/Enricher** —— 不让 LLM 编造。

---

## 1. 主执行路径（Step 1 → Step 40）

按 **严格顺序** 执行；标注 **∥** 的步骤可与上一项并行（人力允许时）。

**图例**：`[ ]` 未开始 · `[~]` 进行中 · `[x]` 已验收

---

### Phase 1 · C7-b：Agent 追问可信 + 可感知（P0 · 已完成）

> **阶段目标**：追问局部修改生效；双端看见 Tool 进度；10 类意图端到端通过。  
> **里程碑 M1**：Step 1～9 全部 `[x]`。

| Step | 状态 | 任务 | 交付 / 落点 | 验收标准（勾选即完成） |
|------|------|------|-------------|------------------------|
| **1** | [x] | **统一意图路由** | graph.py → Node `routeAgentIntent` | [x] 无双套规则 [x] dayIndex 动态 [x] 10 用例仍绿 |
| **2** | [x] | **补 enrich_route 全量链** | graph.py 全量分支 | [x] 全量 Agent 输出含住/行/polyline [x] 字段与管道对齐 |
| **3** | [x] | **修正 agent_state.toolTrace** | `plan-session.service.ts` | [x] 存真实 toolTrace 数组 [x] 非 routed.route 字符串 |
| **4** | [x] | **budget/lodging/qa/select 分支** | graph + Tool/服务 | [x] 预算/住宿/美食问答/选方案 4 类端到端 [x] qa 不触发生成 |
| **5** | [x] | **追问端到端联调** | DB + mobile + PC | [x] 「第三天轻松点」day1～2 不变 [x] 「别去 XX」仅换 POI [x] 失败降级管道 |
| **6** | [x] | **i18n `agent.status.*`** | `@douxing/shared` + build | [x] zh-CN/en-US Tool 进度文案齐全 [x] 无用户可见硬编码 |
| **7** | [x] | **SSE 流式状态（后端）** | `GET /api/plan-sessions/:id/stream` | [x] 推送 tool_call/assistant/done [x] 超时与错误可感知 |
| **8** | [x] | **前端 SSE + 进度 UI** | PC `usePlanPage` + mobile overlay | [x] 遮罩展示 Tool 列表 [x] locale 切换正确 [x] SSE 失败降级 spinner |
| **9** | [x] | **C7-b 阶段验收** | 文档 + 手测清单 | [x] Step 1～8 全勾 [x] §8.2 Agent 清单全勾 [x] **M1 达成** |

**Phase 1 完成后**：开发环境默认 `AGENT_PLAN_ENABLED=true`；生产仍 false，待 M2。

---

### Phase 2 · C7 质量闸门 + 首句 Agent（P0.5 · 已完成）

> **阶段目标**：Agent 与管道等价可量化；可观测；首句可走 Agent；warnings 对用户可见。  
> **里程碑 M2**：Step 10～15 全部 `[x]` · **2026-06-17 达成**。

| Step | 状态 | 任务 | 交付 / 落点 | 验收标准 |
|------|------|------|-------------|----------|
| **10** | [x] | **管道 vs Agent 等价率脚本** | `agent-equivalence-cases.ts` | [x] ≥20 条 seed prompt [x] 报告 JSON 等价率 **≥95%**（20/20 · 100%） |
| **11** | [x] | **Langfuse 接入** | ai-service + Node | [x] 单次规划可查 Tool 链 [x] token/耗时可见（未配 KEY 时 no-op） |
| **12** | [x] | **warnings 写入 assistant 回复** | validate_route → 会话消息 | [x] 闭馆/超预算等出现在对话 [x] i18n |
| **13** | [x] | **`build_route_variants` Tool 化** | `build-route-variants.tool.ts` + graph | [x] Agent 首句可产出 2～3 候选 |
| **14** | [x] | **首句接 Agent** | `createPlanSession` | [x] flag 开时首句走 Agent [x] 等价率仍 ≥95% [x] 失败降级 |
| **15** | [x] | **C7 Agent 核心验收** | `agent:m2-accept` + staging | [x] Step 10～14 全勾 [x] staging 配置 [x] **M2 达成** |

**Phase 2 完成后**：staging 可开 Agent；生产灰度准备就绪。

---

### Phase 3 · H9+ 规划数据质量（P0.5～P1）

> **阶段目标**：路线更准、更可执行；运营可维护 playbook；日期/开放时长正确。  
> **里程碑 M3**：Step 16～22 全部 `[x]`（Step 23～24 按需）。

| Step | 状态 | 任务 | 交付 | 验收标准 |
|------|------|------|------|----------|
| **16** | [x] | **H9+-1 Playbook 库扩充** | seed + alias 对齐 | [x] TOP 10 城市各 ≥1 playbook [x] 命中率可观测 |
| **17** | [x] | **H9+-2 Web Playbook CRUD** | web 管理端 | [x] 运营增删改不发版 [x] i18n 摘要 |
| **18** | [x] | **H9+-4 C2 解析 startDate** | travel-intent + Enricher | [x] 「下周三去杭州」班次日期一致 |
| **19** | [x] | **H9+-5 开放时长补全** | attractions.openHours | [x] 闭馆日 warning 或自动调序 |
| **20** | [x] | **H9+-3 POI soft 对齐** | Enricher + classicOrder | [x] LLM 乱序时贴近经典线或 warning |
| **21** | [x] | **H9+ 阶段验收** | `h9:m3-accept` + 手测 | [x] Step 16～20 全勾 [x] §8.4 自动化全勾 [x] **M3 达成** |
| **22** | [ ] | **（可选）VECTOR_RAG** | `VECTOR_RAG_ENABLED` | [ ] embedding 检索上线 [ ] A/B 命中率提升 |
| **23** | [ ] | **（按需）H9+-6 景区交通 schema** | RouteTransitMode 扩展 | [ ] 观光车/游船/索道 独立标签 |
| **24** | [ ] | **（按需）H9+-7 Juhe 实时班次** | 配置 Key | [ ] 有 Key 走 juhe；无 Key 降级 Catalog |

---

### Phase 4 · C7-c + H3：记忆与规划页宠物（P1）

> **阶段目标**：长期偏好可召回；规划页有宠物口吻；全站悬浮共用 Agent。  
> **里程碑 M4**：Step 25～30 全部 `[x]`。

| Step | 状态 | 任务 | 交付 | 验收标准 |
|------|------|------|------|----------|
| **25** | [x] | **H3-a 领养 API** | `POST /pets/adopt` 等 | [x] 用户可领养 [x] i18n 错误 |
| **26** | [x] | **memory_agent 独立图节点** | `memory_agent.py` + Tool | [x] 偏好召回可解释 [x] 注入 plan context |
| **27** | [x] | **规划页 Focus 宠物 UI** | mobile + PC plan 页 | [x] 口吻化 assistant [x] 记忆摘要可见 |
| **28** | [x] | **H3-b 全站悬浮层** | `TravelPetFloatingLayer` | [x] Tab 页浮球 [x] 调同一 orchestrator |
| **29** | [ ] | **H3-c 记忆墙 / analyze** | `POST /pets/me/analyze` | [ ] 可查看历史记忆与分析 |
| **30** | [ ] | **C7-c + H3 阶段验收** | 手测 | [ ] 第二轮规划体现「上次遗憾」 [ ] **M4 达成** |

---

### Phase 5 · H8 / H7：行中智能（P1）

> **阶段目标**：行中可重排；错过景点可补救并写入 memory。  
> **里程碑 M5**：Step 31～34 全部 `[x]`。  
> **前置**：Phase 1～2 完成；路线发布/打卡链路稳定。

| Step | 状态 | 任务 | 交付 | 验收标准 |
|------|------|------|------|----------|
| **31** | [ ] | **H8 `replan_segment` Tool** | agent Tool + 服务 | [ ] GPS + 剩余 POI 算新顺序 |
| **32** | [ ] | **H8 transit_agent + UI** | 行中入口 | [ ] 一键刷新当日 [ ] **用户确认**后写回 [ ] 不静默改已发布 |
| **33** | [ ] | **H7 错过景点补救** | 对比计划 vs 打卡/GPS | [ ] 「应到未到」列表 [ ] 替补推荐 [ ] 写入 memory |
| **34** | [ ] | **H3-d 行中宠物 + 阶段验收** | 打卡 exp / 庆祝 | [ ] 行中可触发分析 [ ] **M5 达成** |

---

### Phase 6 · I 线专属模型 + C7-d 收尾（P2）

> **阶段目标**：专属 LoRA 接入 plan_agent；JSON 合法率与成本优于基线。  
> **前置**：阿里云 OSS/PAI/百炼资源就绪。  
> **里程碑**：Step 35～37 全部 `[x]` → **C7-d 完整验收**。

| Step | 状态 | 任务 | 交付 | 验收标准 |
|------|------|------|------|----------|
| **35** | [ ] | **I2 PAI LoRA 微调** | OSS + PAI 任务 | [ ] 微调成功 [ ] artifact 可注册 |
| **36** | [ ] | **I3 百炼推理接入** | llmProvider + 降级 | [ ] 生产可切换 [ ] 失败降级 DeepSeek |
| **37** | [ ] | **C7-d LoRA → plan_agent** | ai-service graph | [ ] JSON 合法率 ≥ 基线 [ ] POI 命中率不降 [ ] A/B 报告 |

---

### Phase 7 · H10 路线可信度（P2～P3 · 增强「敢照着走」）

> **阶段目标**：规划结果 POI 有说明/评论/视频背书。  
> **里程碑 M6 组成部分**（与 Phase 1～6 共同构成「全部验收」）。

| Step | 状态 | 任务 | 验收标准 |
|------|------|------|----------|
| **38** | [ ] | **H10-a 景点说明 + 评论强化** | [ ] POI 详情有说明+评+打卡图 |
| **39** | [ ] | **H10-b + H10-c UGC 视频** | [ ] 路线/POI 可绑 ≤60s 视频 [ ] 详情/手帐可播放 |
| **40** | [ ] | **H10-d 热评聚合** | [ ] 热门讨论区 [ ] 外链二次确认 |
| **41** | [ ] | **（远期）H10-e vlog→规划** | [ ] ASR+OCR 提取地名 [ ] 人工确认写入 |
| **42** | [ ] | **（远期）H3-e 向量记忆** | [ ] embedding 检索 [ ] 月度旅行 DNA |

---

## 2. 里程碑与「全部验收完成」定义

### 2.1 里程碑一览

| 里程碑 | 包含 Step | 含义 | 状态 |
|--------|-----------|------|------|
| **M0** | （已完成） | C1～C6 + H9-1～4 + C7-a 管道与 Tool 基础 | ✅ |
| **M1** | 1～9 | **Agent 追问闭环** — 局部 patch + SSE + i18n | ✅ |
| **M2** | 10～15 | **Agent 可上 staging** — 等价率 + 首句 Agent | ✅ |
| **M3** | 16～21 | **规划数据质量** — playbook + 日期 + 开放时长 | ✅ |
| **M4** | 25～30 | **记忆与宠物** — 偏好召回 + 规划页/悬浮 | [ ] |
| **M5** | 31～34 | **行中智能** — 重规划 + 错过补救 | [ ] |
| **M6** | 1～40（必做）+ 41～42（远期） | **路线图全部验收** | [ ] |

### 2.2 什么叫「全部验收完成」

以下 **必做项** 全部勾选，即视为本路线图 **主链验收完成**（M6）：

| 维度 | 必做验收项 |
|------|------------|
| **管道基线** | C1～C6、H9-1～4 回归通过（§10.1） |
| **Agent C7** | M1 + M2 达成；生产可灰度 `AGENT_PLAN_ENABLED` |
| **数据质量** | M3 达成（H9+-1/2/4/5/3） |
| **记忆宠物** | M4 达成（H3-a～c + C7-c） |
| **行中** | M5 达成（H7 + H8） |
| **专属模型** | I2 + I3 + C7-d（Step 35～37） |
| **可信度** | H10-a + H10-b + H10-c + H10-d（Step 38～40） |
| **国际化** | 上述所有用户可见文案 zh-CN / en-US 无遗漏 |
| **降级** | Agent/LLM/外部 API 失败均可回退，不白屏 |

**远期可选项**（不阻塞 M6 主链声明，但写入路线图）：Step 22～24（VECTOR_RAG、Juhe、景区 schema）、Step 41～42（vlog 规划、向量记忆）。

### 2.3 快速跳转：我在哪一步？

```text
刚接手项目        → 读 §0.1，从 Step 1 开始
C7-b 后端已联调   → 从 Step 6（i18n）或 Step 7（SSE）开始
Agent 已上 staging → 从 Step 27（规划页宠物 UI）开始
要做行中能力      → 确认 M1+M2+M3 已达成，从 Step 31 开始
要做专属模型      → 确认 M1 已达成，从 Step 35 开始（可与 Phase 3 并行）
```

---

## 3. 产品目标与能力全景

### 3.1 一句话

**你负责游玩，其他的交给我** —— 产出 **可执行、可追问、可记忆、可信任** 的个性化路线。

### 3.2 能力编号与状态

| 编号 | 名称 | 状态 | 对应 Step |
|------|------|------|-----------|
| **C** | 规划管道 MVP | ✅ 已验收 | M0 |
| **H9** | 住行增强 | ✅ 已验收 | M0 |
| **C7** | AI Agent 演进 | ✅ M1 + M2 已达成 | Step 1～15 ✅ |
| **H9+** | 规划数据质量 | ✅ M3 已达成 | Step 16～21 ✅ · Step 22～24 按需 |
| **H3** | AI 旅行宠物 | 🔄 Step 25 ✅ | Step 25 ✅ · Step 26～30 |
| **H7/H8** | 行中智能 | ⏳ | Step 31～34 |
| **I** | 专属模型 | 🔄 I1 ✅ | Step 35～37 |
| **H10** | 路线可信度 | ⏳ | Step 38～41 |

### 3.3 端侧

| 端 | 路径 | 状态 |
|----|------|------|
| 移动端 | `packages/mobile/src/pages/plan/plan.vue` | ✅ |
| PC | `packages/pc/src/views/PlanView.vue` | ✅ |
| Web 管理端 Playbook | H9+-2 | ✅ Step 17 |

---

## 4. 架构速查

### 4.1 现状（默认 `AGENT_PLAN_ENABLED=false`）

```text
用户 → plan_sessions → generateRoute 固定管道 → 2～3 候选 → 发布
追问 → 整段 regenerateRouteFromPrompt
```

### 4.2 目标（Agent 开启后）

```text
用户 → plan_sessions → Supervisor(graph.py) → 意图路由
     → 规划/记忆/行中 专家 → Node Tools → draft + toolTrace
追问 tweak → patch_route_day（局部）→ enrich → validate
失败 → 降级 generateRoute
```

### 4.3 代码落点

| 模块 | 路径 |
|------|------|
| 会话 | `server/src/services/plan-session.service.ts` |
| 管道 | `server/src/services/route-generator.service.ts` |
| Agent 客户端 | `server/src/services/agent-plan-client.service.ts` |
| 意图路由 | `server/src/services/agent-intent-router.service.ts` |
| Tools | `server/src/agent/tools/*` |
| 编排 | `packages/ai-service/app/agent/graph.py` |
| PC 规划页 | `packages/pc/src/composables/usePlanPage.ts` |
| 移动规划页 | `packages/mobile/src/pages/plan/plan.vue` |

---

## 5. 已完成清单（M0 · 无需再做）

<details>
<summary>点击展开 C / H9 / C7-a 已验收项</summary>

**C1～C6**：多轮会话 · 意图 · RAG · 多方案 · ai-service · ML 数据管线  
**H9-1～4**：Enricher · polyline · Catalog · 玩法 RAG  
**体验**：语音 ASR · PC 双栏 · i18n · Loading 遮罩  
**C7-a**：9 Tool · `/v1/agent/plan` · feature flag · agent_state 列 · 意图脚本

</details>

---

## 6. 分阶段任务详情（与 Step 对照）

> Step 编号以 **§1** 为准；本节补充实现要点。

### 6.1 Step 1～9 实现要点（Phase 1）

**Step 1 · 统一路由**

```text
新增 POST /api/agent/route-intent { message } → RoutedAgentIntent
graph.py 首步 HTTP 调用，删除 _route_intent 本地函数
```

**Step 2 · enrich 链**

```text
generate_route_draft（draftOnly，不含 Enricher）→ enrich_route → validate_route
patch_route_day（skipFinalize）→ enrich_route → validate_route
generate-route-draft.tool / patch-route-day.tool 默认走 Agent 链；管道 generateRoute 仍走完整 finalize
```

**Step 3 · agent_state.toolTrace**

```text
appendPlanSessionMessage → runAgentPlan → agentState.toolTrace = agentResult.toolTrace（数组）
generationPath: agent | pipeline；GET 会话详情与 append 响应均返回 agentState
```

**Step 3 验收**：追问后 DB `plan_sessions.agent_state.toolTrace` 为 `[{ tool, ok, ms }, …]`；管道降级时 `generationPath=pipeline` 且 `toolTrace=[]`。

**Step 4 · 四类分支**

| 意图 | graph / Tool | 行为 |
|------|--------------|------|
| budget_tune | `tune_route_budget` → enrich → validate | 更新 budgetRange，重跑 Enricher |
| lodging_tune | enrich → validate | 按新住宿偏好重分配住店 |
| qa_food | `answer_food_qa` | 仅返回美食文案，**不** generate |
| select_variant | `select_plan_variant` | 解析方案字母，切换候选，无 LLM |

**Step 5 · 追问 E2E**

```bash
pnpm --filter @douxing/server agent:e2e-cases   # 局部修改：day1～2 不变 / 排除 POI
pnpm --filter @douxing/server agent:intent-cases
pnpm --filter @douxing/server agent:branch-cases
```

**Step 5 手测清单**（`AGENT_PLAN_ENABLED=true`，Node + ai-service）：

1. 创建 3 日游会话 → 追问「第三天轻松一点」→ 第 1～2 天景点名不变
2. 追问「别去河坊街」→ 仅含河坊街的那天移除/替换，其它天不变
3. 停 ai-service → 追问仍返回新方案（管道降级，`generationPath=pipeline`）

**Step 5 代码要点**：`patch_route_day` 支持无 `dayIndex` 时按 POI 名定位天数；排除模式只换被删 POI 槽位，不重写整天。

**Step 7～8 · SSE 契约**

| 事件 |  payload  |
|------|-----------|
| `tool_call` | `{ tool, status, ms }` |
| `assistant` | `{ delta? , final? }` |
| `done` | session 完整 payload |
| `error` | `{ messageKey }` |

### 6.2 Step 10～15 实现要点（Phase 2）

- **等价率脚本（Step 10 ✅）**：`agent-equivalence.service.ts` + `agent-equivalence-cases.ts`；对比城市、天数、按天 POI 集合（允许文案差异）；种子 `prompts-seed.jsonl`（20 条）。
- **运行模式**：默认 `deterministic`（关 LLM/ai-service）；`--fast` 跳过 Enricher；`--live` 走 LLM；`--report` 输出 JSON。
- **Langfuse 观测（Step 11 ✅）**：
  - Python：`app/observability/langfuse_client.py` — Agent Tool trace · route-generate trace · LangChain CallbackHandler
  - Node：`observability/langfuse-client.service.ts` — LLM generation 层级
  - 环境变量：`LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST`（未配 KEY 时 no-op）
  - 验证：`pnpm --filter @douxing/server langfuse:smoke`；`GET /v1/status` 返回 `observability.langfuse`
- **首句 Agent 开启条件**：等价率 ≥95% + Langfuse 可观测 + staging 手测。
- **Step 15 验收（M2 ✅）**：
  ```bash
  pnpm --filter @douxing/server agent:m2-accept          # 一键：intent + branch + e2e + m2 + 等价率
  pnpm --filter @douxing/server agent:m2-cases           # 仅 Step 12～14 本地断言
  ```
  staging 部署：`deploy/env.staging.example` 已含 `AGENT_PLAN_ENABLED=true`；上线后按脚本末尾手测清单 6 条确认。
- **生产策略**：M2 后 staging true；生产 false → 灰度 → 全量。

### 6.3 Step 16～24 · H9+ 顺序

```text
16 → 17（数据+运营）
18 ∥ 19（日期+开放时长，可并行）
→ 20 → 21 验收
22～24 按需
```

### 6.4 Step 25～30 · H3 与 C7-c

详述：[AI旅行宠物.md](./AI旅行宠物.md)

### 6.5 Step 31～34 · 行中

- H8 依赖 Enricher `buildDailySchedule`、GPS、C7 Tool 体系。
- H7 遗漏 POI 写入 `pet_memories`，下次规划由 memory_agent 补偿。

### 6.6 Step 35～37 · 专属模型

操作手册：[阿里云-兜行专属模型训练与部署.md](./阿里云-兜行专属模型训练与部署.md)

---

## 7. 环境与验证

```env
AGENT_PLAN_ENABLED=false          # Phase 1 开发时改为 true
AGENT_TOOL_SECRET=随机长字符串
AGENT_PLAN_TIMEOUT_MS=180000
AI_SERVICE_ENABLED=true
AI_SERVICE_URL=http://127.0.0.1:8100
```

```bash
# Step 1 完成后必跑
pnpm --filter @douxing/server agent:intent-cases

# Step 10 完成后必跑
pnpm --filter @douxing/server agent:equivalence-cases          # 全链（含 Enricher，需 DB）
pnpm --filter @douxing/server agent:equivalence-cases -- --fast   # CI 快速：仅 generate 阶段
pnpm --filter @douxing/server agent:m2-accept                    # M2 一键验收（Step 15）
pnpm --filter @douxing/server playbook:cases                     # M3 Step 16 Playbook 验收
pnpm --filter @douxing/server playbook:crud-cases                # M3 Step 17 CRUD 验收
pnpm --filter @douxing/server start-date:cases                   # M3 Step 18 startDate
pnpm --filter @douxing/server open-hours:cases                 # M3 Step 19 开放时长
pnpm --filter @douxing/server playbook-order:cases             # M3 Step 20 POI 对齐
pnpm --filter @douxing/server h9:m3-accept                       # M3 一键验收（Step 21）
pnpm --filter @douxing/server h9:m3-accept -- --skip-db          # 无 MySQL 时跳过 CRUD
pnpm --filter @douxing/server pet:adopt-cases                    # M4 Step 25 领养 API
pnpm --filter @douxing/server memory-agent:cases                 # M4 Step 26 memory_agent
pnpm --filter @douxing/server plan-pet-focus:cases               # M4 Step 27 Focus UI
pnpm --filter @douxing/server langfuse:smoke

pnpm --filter @douxing/server exec tsc --noEmit
pnpm dev
```

```bash
# Step 2 手测：POST /v1/agent/plan 返回 toolTrace 含 enrich_route → validate_route
# draft.routeDetail.days[*] 含 lodging / transit / polyline（与管道 Enricher 一致）
```

详见 [env-environments.md §7](./env-environments.md#7-agent-与向量-ragc7--c3-扩展)。

---

## 8. 总验收自检清单

> 与 §1 各 Step 验收项一致；里程碑达成时整段勾选。

### 8.1 M0 管道基线（回归）

- [x] 首句 1～3 套候选
- [x] 追问可改方案（管道）
- [x] 语音 ASR
- [x] zh-CN / en-US
- [x] Enricher warnings 在详情可见

### 8.2 M1 Agent 追问（Step 1～9）

- [x] flag 关 = 现网
- [x] Tool 失败降级
- [x] 意图 10 用例脚本
- [x] 统一路由
- [x] enrich 链（Step 2）
- [x] toolTrace 持久化（Step 3）
- [x] 四类分支（Step 4）
- [x] 追问 day 保留（Step 5）
- [x] SSE + i18n（Step 6～8 已落地）
- [x] Step 9 阶段验收（`agent:intent-cases` · `agent:branch-cases` · `agent:e2e-cases` 全绿 · 2026-06-17）

### 8.3 M2 Agent 上 staging（Step 10～15）

- [x] 等价率 ≥95%（`agent:equivalence-cases` · 2026-06-17 · 20/20）
- [x] Langfuse（`app/observability/langfuse_client.py` · Node `langfuse-client.service.ts` · 2026-06-17）
- [x] warnings 进对话（`appendPlanAssistantWarnings` · 2026-06-17）
- [x] Agent 多方案 Tool（`build_route_variants` · graph + 本地 Agent · 2026-06-17）
- [x] 首句 Agent（`createPlanSession` · Agent 失败降级管道 · 2026-06-17）
- [x] staging 配置 + 自动化验收（`agent:m2-accept` · 2026-06-17）· **M2 达成**

### 8.4 M3 数据质量（Step 16～21）

- [x] TOP 10 playbook（`playbook:cases` · 14 条 seed · 2026-06-18）
- [x] Web Playbook CRUD（`playbook:crud-cases` · 双语摘要 · 启用筛选 · 2026-06-18）
- [x] startDate + 开放时长（`start-date:cases` · `open-hours:cases` · 2026-06-18）
- [x] POI soft 对齐（`playbook-order:cases` · 2026-06-18）
- [x] M3 一键验收（`h9:m3-accept` · Step 16～20 全绿 · 2026-06-18）· **M3 达成**

### 8.5 M4 记忆宠物（Step 25～30）

- [x] 领养 API（`pet:adopt-cases` · `POST /api/pets/adopt` · 2026-06-18）
- [x] memory_agent 节点（`memory-agent:cases` · graph + apply_memory_context · 2026-06-18）
- [x] 规划页 Focus UI（`plan-pet-focus:cases` · mobile + PC · 2026-06-18）
- [ ] 全站悬浮层 + 记忆墙

### 8.6 M5 行中（Step 31～34）

- [ ] H8 重规划 + H7 错过补救

### 8.7 M6 完整闭环（Step 35～40 + 必做 H10）

- [ ] I2/I3 + LoRA plan_agent
- [ ] H10-a/b/c/d

---

## 9. 不建议优先做

| 项 | 原因 |
|----|------|
| 6 类 Agent 全独立进程 | 运维成本高 |
| Group Chat 多 Agent | 慢、贵、难 debug |
| 推倒 generateRoute | 破坏 M0 已验收链路 |
| Step 41 vlog→规划 | 研究型，放 M6 之后 |
| F 线 3D 地图 | 非规划主链 |

---

## 10. 相关文档

| 文档 | 用途 |
|------|------|
| [AI规划与Agent演进.md](./AI规划与Agent演进.md) | 架构设计 · Tool 映射 · 场景流程 |
| [AI旅行宠物.md](./AI旅行宠物.md) | H3 Step 25～30 细节 |
| [下一步工作.md](./下一步工作.md) | 全站当前 Sprint（非仅规划） |
| [ROADMAP.md](./ROADMAP.md) | 全站编号与历史 |
| [API接口文档.md §20](./API接口文档.md#20-agent-tools内网) | Agent Tools API |

---

## 11. 维护约定

1. **完成某 Step 后**：将 §1 对应行状态改为 `[x]`，勾选 §8 验收项，更新 §0.2 进度条。
2. **当前指针**：始终维护 §0.1「下一项工作」= 第一个 `[ ]` 的 Step；同步更新 **功能作用**、**预期效果**（说明「为何做」与「做完用户/系统会怎样」）。
3. **设计变更**：写入 [AI规划与Agent演进.md](./AI规划与Agent演进.md)；本文只改 Step/验收。
4. **API 变更**：同步 openapi.yaml 与 API 文档。

---

## 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-06-16 | 1.0 | 初版 |
| 2026-06-16 | 2.4 | Step 5 追问 E2E：patch 排除 POI + agent:e2e-cases |
| 2026-06-17 | 2.5 | **Step 9 / M1 验收**：三类 Agent 脚本全绿 · 指针 → Step 10 |
| 2026-06-17 | 2.6 | §0.1 增加 **功能作用**、**预期效果** 字段 |
| 2026-06-17 | 2.7 | **Step 10 验收**：`agent:equivalence-cases` · 20/20 · 100% |
| 2026-06-17 | 2.8 | **Step 11 Langfuse**：ai-service Tool trace + Node LLM generation |
| 2026-06-17 | 2.9 | **Step 12～14**：warnings 进对话 · build_route_variants · createPlanSession Agent |
| 2026-06-17 | 3.0 | **Step 15 / M2 达成**：`agent:m2-accept` · staging Agent 配置 · 指针 → Step 16 |
| 2026-06-18 | 3.1 | **Step 16 / H9+-1**：14 条 playbook seed · C3 alias 对齐 · `playbook:cases` 命中率 100% |
| 2026-06-18 | 3.2 | **Step 17 / H9+-2**：Web CRUD 验收 · `playbook:crud-cases` · 启用筛选 · ApiError 校验 |
| 2026-06-18 | 3.3 | **Step 18～19**：C2 `parseStartDateFromText` · openHours seed 补全 · 验收脚本全绿 |
| 2026-06-18 | 3.4 | **Step 20 / H9+-3**：`softAlignDayPoisToPlaybook` · classicOrder 重排 + i18n warning |
| 2026-06-18 | 3.5 | **Step 21 / M3 达成**：`h9:m3-accept` 全绿 · 修复 CRUD 脚本 DB 连接未退出 · 指针 → Step 25 |
| 2026-06-18 | 3.6 | **Step 25 / H3-a**：`POST/PATCH /api/pets/*` · `pet:adopt-cases` · 双语 ApiMessageKey |
| 2026-06-18 | 3.7 | **Step 26 / C7-c**：`memory_agent.py` · `apply_memory_context` Tool · `memory-agent:cases` |
| 2026-06-18 | 3.8 | **Step 27 / H3-a UI**：`PlanPetFocusCard` · petMeta · 助手口吻 · `plan-pet-focus:cases` |
