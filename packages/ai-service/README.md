# 兜行 Python AI 微服务

FastAPI + LangChain，负责路线规划 LLM 调用与 **Agent 编排**（C7）。Node 后端通过 HTTP 调用，失败时自动回退到 Node 内置 LLM 或模板。

## 环境要求

- Python 3.12+
- 与 Node 共用项目根目录 `.env`（DeepSeek / LM Studio / Agent 配置）

## 安装与启动

```bash
# 项目根目录
cd packages/ai-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 开发模式（热重载，默认 8100 端口，在项目根目录执行）
pnpm dev:ai-service
# 或：npm run dev:ai-service
# 或：python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8100
```

在 `.env` 中启用 Node 侧调用：

```env
AI_SERVICE_ENABLED=true
AI_SERVICE_URL=http://127.0.0.1:8100

# Agent 规划（默认关闭；开启后 plan_sessions 追问可走 patch）
AGENT_PLAN_ENABLED=false
AGENT_TOOL_SECRET=与 Node 一致的随机密钥
```

Node 调用 Python Agent 时，Python 通过 `node_client.py` 回调 Node 内网 API：

- `POST /api/agent/route-intent` — 追问意图路由（Step 1）
- `POST /api/agent/tools/:name` — 确定性 Tool 执行

请求头需带 `x-agent-tool-secret`。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/v1/status` | LLM 提供商状态 |
| POST | `/v1/route/generate` | 生成路线 JSON（C5 管道） |
| POST | `/v1/agent/plan` | **Agent 规划**（C7）：意图路由 + Tool 链；返回 `draft`、`toolTrace`、`routedIntent` |

### `/v1/agent/plan` 请求体（摘要）

| 字段 | 类型 | 说明 |
|------|------|------|
| `prompt` | string | 用户当前句 |
| `userId` | number | 用户 ID |
| `history` | array | 多轮历史（可选） |
| `days` / `budget` | number / string | 约束（可选） |
| `locale` | `zh-CN` \| `en-US` | 语言 |
| `currentDraft` | object | 追问改天时传入当前路线 draft |

### Agent Tool 链（`app/agent/graph.py`）

**追问改天（tweak_day / tweak_poi + dayIndex）**

```text
route-intent → recall_user_memory → parse_intent
  → patch_route_day → enrich_route → validate_route
```

**预算 / 住宿（budget_tune / lodging_tune）**

```text
… → parse_intent → tune_route_budget（仅 budget）→ enrich_route → validate_route
… → parse_intent → enrich_route → validate_route（lodging）
```

**美食问答（qa_food）**

```text
… → parse_intent → answer_food_qa（无 generate_route_draft）
```

**选方案（select_variant）**

```text
… → select_plan_variant（需 sessionId，无 LLM）
```

**全量（plan_new 等）**

```text
route-intent → recall_user_memory → parse_intent → retrieve_attractions
  → generate_route_draft → enrich_route → validate_route
```

**追问改天（tweak_day / tweak_poi + dayIndex）**

```text
route-intent → recall_user_memory → parse_intent
  → patch_route_day → enrich_route → validate_route
```

Tool 权威实现：`packages/server/src/agent/tools/`。

## 降级链

`Python Agent（flag 开）` → `Python /v1/route/generate` → `Node LLM（DeepSeek/LM Studio）` → `模板/RAG 组装`

## 相关文档

- [AI路径规划路线图.md](../../docs/AI路径规划路线图.md) — **Step 1～42 · 当前 Step 6**
- [AI规划与Agent演进.md](../../docs/AI规划与Agent演进.md) — 设计全稿
- [开发记录 § C7](../../docs/开发记录-重难点与亮点.md#c7-ai-agent-代码落地2026-06-16)
