# Route Solver 外置服务

与兜行业务解耦的路径优化 HTTP 服务（FastAPI + OR-Tools）。

## 启动

```bash
cd packages/or-tools/service
python -m venv .venv
# Windows
.venv\Scripts\pip install -r requirements.txt
# 或根目录
pnpm dev:route-solver
```

默认：`http://127.0.0.1:8200`

## 契约

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/v1/route/factors` | 推荐预设与影响因素目录 |
| POST | `/v1/route/solve` | 求解一日访问顺序 |

Node 侧通过 `ROUTE_SOLVER_URL` 代理，Web 管理端「路径算法实验室」只调 `/api/admin/route-solver/*`。

## 环境变量（根目录 `.env`）

```text
ROUTE_SOLVER_ENABLED=true
ROUTE_SOLVER_URL=http://127.0.0.1:8200
ROUTE_SOLVER_TIMEOUT_MS=60000
```
