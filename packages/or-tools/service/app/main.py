"""
Route Solver 外置算法服务（FastAPI）。

与兜行 Node/Web 解耦：仅通过 HTTP 契约交互，不依赖业务库。
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .schemas import (
  FactorCatalogResponse,
  HealthResponse,
  SolveRouteRequest,
  SolveRouteResponse,
)
from .solver import list_factor_catalog, solve_route

app = FastAPI(
  title="Douxing Route Solver",
  description="外置路径优化服务（OR-Tools Routing），供管理端可视化与业务侧按需调用",
  version="0.1.0",
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=["*"],
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
  """
  健康检查。

  Returns:
      服务名、版本与 ortools 是否可导入
  """
  ortools_ok = True
  try:
    import ortools  # noqa: F401
  except Exception:
    ortools_ok = False
  return HealthResponse(
    service="route-solver",
    version="0.1.0",
    ortoolsAvailable=ortools_ok,
  )


@app.get("/v1/route/factors", response_model=FactorCatalogResponse)
def factors() -> FactorCatalogResponse:
  """
  返回推荐影响因素目录，供管理端渲染配置项。

  Returns:
      预设方案与可配置因子列表
  """
  return list_factor_catalog()


@app.post("/v1/route/solve", response_model=SolveRouteResponse)
def solve(body: SolveRouteRequest) -> SolveRouteResponse:
  """
  按节点与影响因素求解一日最佳访问顺序。

  Args:
      body: 节点、可选耗时矩阵、求解选项

  Returns:
      顺序、总代价、应用因子说明

  Raises:
      HTTPException: 参数非法或无可行解时 400
  """
  try:
    return solve_route(body)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc)) from exc
