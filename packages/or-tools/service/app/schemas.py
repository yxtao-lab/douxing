"""Route Solver HTTP 请求/响应模型。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RouteNode(BaseModel):
  """路线节点（0 号约定为 depot/酒店）。"""

  id: str = Field(..., min_length=1, max_length=64)
  name: str = Field(..., min_length=1, max_length=128)
  lat: float | None = None
  lng: float | None = None
  """游玩停留分钟；参与时间窗累计时使用。"""
  stayMinutes: int = Field(default=60, ge=0, le=24 * 60)
  """开闭馆窗口 [最早到达, 最晚到达]，单位为当日分钟；null 表示不启用。"""
  windowStart: int | None = Field(default=None, ge=0, le=24 * 60)
  windowEnd: int | None = Field(default=None, ge=0, le=24 * 60)


class SolveOptions(BaseModel):
  """求解影响因素（与管理端表单对齐）。"""

  preset: Literal["balanced", "fast", "quality", "open_hours"] | None = "balanced"
  timeLimitSeconds: float = Field(default=2.0, ge=0.1, le=120)
  firstSolution: str = "PATH_CHEAPEST_ARC"
  metaheuristic: str = "GUIDED_LOCAL_SEARCH"
  returnToDepot: bool = False
  """行驶时间权重（主目标）。"""
  travelTimeWeight: float = Field(default=1.0, ge=0, le=10)
  """直线距离权重；>0 且节点有坐标时与行驶时间加权混合。"""
  distanceWeight: float = Field(default=0.0, ge=0, le=10)
  """是否启用节点时间窗（开闭馆）。"""
  enableTimeWindows: bool = False
  depotStartMinutes: int = Field(default=9 * 60, ge=0, le=24 * 60)
  waitingSlackMinutes: int = Field(default=30, ge=0, le=240)


class SolveRouteRequest(BaseModel):
  """求解请求体。"""

  nodes: list[RouteNode] = Field(..., min_length=1, max_length=40)
  """可选 N×N 整数代价矩阵（分钟）；缺省时用坐标 Haversine 估速生成。"""
  durationMatrix: list[list[int]] | None = None
  options: SolveOptions = Field(default_factory=SolveOptions)


class AppliedFactor(BaseModel):
  """本次求解实际生效的影响因素说明。"""

  key: str
  label: str
  value: str


class SolveRouteResponse(BaseModel):
  """求解结果。"""

  order: list[int]
  orderIds: list[str]
  orderNames: list[str]
  totalCost: int
  costUnit: str = "minutes"
  appliedFactors: list[AppliedFactor]
  matrixSource: Literal["provided", "haversine_estimate"]
  solveMs: int


class HealthResponse(BaseModel):
  """健康检查。"""

  service: str
  version: str
  ortoolsAvailable: bool


class FactorOption(BaseModel):
  """单个因子的可选值。"""

  value: str
  label: str
  recommended: bool = False


class FactorDefinition(BaseModel):
  """管理端可渲染的因子定义。"""

  key: str
  label: str
  description: str
  type: Literal["enum", "number", "boolean"]
  recommended: bool = True
  options: list[FactorOption] | None = None
  min: float | None = None
  max: float | None = None
  step: float | None = None
  default: str | float | bool | None = None


class PresetDefinition(BaseModel):
  """推荐预设方案。"""

  id: str
  label: str
  description: str
  options: SolveOptions


class FactorCatalogResponse(BaseModel):
  """因子目录。"""

  presets: list[PresetDefinition]
  factors: list[FactorDefinition]
