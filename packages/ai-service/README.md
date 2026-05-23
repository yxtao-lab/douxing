# 兜行 Python AI 微服务

FastAPI + LangChain，负责路线规划 LLM 调用。Node 后端通过 HTTP 调用，失败时自动回退到 Node 内置 LLM 或模板。

## 环境要求

- Python 3.12+
- 与 Node 共用项目根目录 `.env`（DeepSeek / LM Studio 配置）

## 安装与启动

```bash
# 项目根目录
cd packages/ai-service
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 开发模式（热重载，默认 8100 端口）
pnpm dev
# 或：python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8100
```

在 `.env` 中启用 Node 侧调用：

```env
AI_SERVICE_ENABLED=true
AI_SERVICE_URL=http://127.0.0.1:8100
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/v1/status` | LLM 提供商状态 |
| POST | `/v1/route/generate` | 生成路线 JSON |

## 降级链

`Python AI 服务` → `Node LLM（DeepSeek/LM Studio）` → `模板/RAG 组装`
