# @douxing/or-tools

兜行 monorepo 内路径优化能力封装。

| 项 | 内容 |
|----|------|
| Python 产品仓（示例/模板） | [yxtao-lab/python-route-solver](https://github.com/yxtao-lab/python-route-solver) → `upstream/` |
| **外置求解服务（解耦）** | `service/`（FastAPI + OR-Tools，默认端口 8200） |
| 管理端可视化 | Web「数据中台 → 路径算法实验室」`/route-solver-lab` |

## 外置服务（推荐接入方式）

```bash
# 安装依赖并启动
cd packages/or-tools/service
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # Windows
pnpm dev:route-solver
```

根目录 `.env`：

```text
ROUTE_SOLVER_ENABLED=true
ROUTE_SOLVER_URL=http://127.0.0.1:8200
```

契约：`GET /health` · `GET /v1/route/factors` · `POST /v1/route/solve`  
详见 `service/README.md`。

Node 仅做鉴权代理（`/api/admin/route-solver/*`），**不内嵌算法**；业务路线 Enricher 后续也可同 URL 调用。

## 本地示例脚本

```bash
pip install -r packages/or-tools/examples/requirements.txt
python packages/or-tools/examples/solve_day_route.py
```

## Submodule

```bash
git submodule update --init --depth 1 packages/or-tools/upstream
```
