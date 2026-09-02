"""OR-Tools Routing 求解与因子目录。"""

from __future__ import annotations

import math
import time
from copy import deepcopy

from ortools.constraint_solver import pywrapcp, routing_enums_pb2

from .schemas import (
  AppliedFactor,
  FactorCatalogResponse,
  FactorDefinition,
  FactorOption,
  PresetDefinition,
  SolveOptions,
  SolveRouteRequest,
  SolveRouteResponse,
)

FIRST_SOLUTION_MAP = {
  "PATH_CHEAPEST_ARC": routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC,
  "SAVINGS": routing_enums_pb2.FirstSolutionStrategy.SAVINGS,
  "CHRISTOFIDES": routing_enums_pb2.FirstSolutionStrategy.CHRISTOFIDES,
  "PARALLEL_CHEAPEST_INSERTION": (
    routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
  ),
}

METAHEURISTIC_MAP = {
  "": None,
  "GUIDED_LOCAL_SEARCH": routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH,
  "SIMULATED_ANNEALING": routing_enums_pb2.LocalSearchMetaheuristic.SIMULATED_ANNEALING,
  "TABU_SEARCH": routing_enums_pb2.LocalSearchMetaheuristic.TABU_SEARCH,
}

PRESET_OPTIONS: dict[str, SolveOptions] = {
  "balanced": SolveOptions(
    preset="balanced",
    timeLimitSeconds=2.0,
    firstSolution="PATH_CHEAPEST_ARC",
    metaheuristic="GUIDED_LOCAL_SEARCH",
    returnToDepot=False,
    travelTimeWeight=1.0,
    distanceWeight=0.0,
    enableTimeWindows=False,
  ),
  "fast": SolveOptions(
    preset="fast",
    timeLimitSeconds=0.5,
    firstSolution="PATH_CHEAPEST_ARC",
    metaheuristic="",
    returnToDepot=False,
    travelTimeWeight=1.0,
    distanceWeight=0.0,
    enableTimeWindows=False,
  ),
  "quality": SolveOptions(
    preset="quality",
    timeLimitSeconds=8.0,
    firstSolution="CHRISTOFIDES",
    metaheuristic="GUIDED_LOCAL_SEARCH",
    returnToDepot=False,
    travelTimeWeight=1.0,
    distanceWeight=0.2,
    enableTimeWindows=False,
  ),
  "open_hours": SolveOptions(
    preset="open_hours",
    timeLimitSeconds=5.0,
    firstSolution="PATH_CHEAPEST_ARC",
    metaheuristic="GUIDED_LOCAL_SEARCH",
    returnToDepot=False,
    travelTimeWeight=1.0,
    distanceWeight=0.0,
    enableTimeWindows=True,
    waitingSlackMinutes=45,
  ),
}


def list_factor_catalog() -> FactorCatalogResponse:
  """
  构建管理端推荐因子与预设目录。

  Returns:
      FactorCatalogResponse
  """
  presets = [
    PresetDefinition(
      id="balanced",
      label="均衡（推荐）",
      description="默认一日游：短时限 + 引导局部搜索，适合管理端试算",
      options=PRESET_OPTIONS["balanced"],
    ),
    PresetDefinition(
      id="fast",
      label="快速试算",
      description="关闭元启发式，亚秒级出结果，适合调矩阵",
      options=PRESET_OPTIONS["fast"],
    ),
    PresetDefinition(
      id="quality",
      label="质量优先",
      description="更长时限 + Christofides，并轻微混合直线距离",
      options=PRESET_OPTIONS["quality"],
    ),
    PresetDefinition(
      id="open_hours",
      label="开闭馆严格",
      description="启用时间窗，按景点开放时段约束到达",
      options=PRESET_OPTIONS["open_hours"],
    ),
  ]
  factors = [
    FactorDefinition(
      key="firstSolution",
      label="初始解策略",
      description="构造第一条可行路径的启发式",
      type="enum",
      recommended=True,
      default="PATH_CHEAPEST_ARC",
      options=[
        FactorOption(value="PATH_CHEAPEST_ARC", label="最便宜弧（推荐）", recommended=True),
        FactorOption(value="SAVINGS", label="节约算法"),
        FactorOption(value="CHRISTOFIDES", label="Christofides"),
        FactorOption(value="PARALLEL_CHEAPEST_INSERTION", label="并行最便宜插入"),
      ],
    ),
    FactorDefinition(
      key="metaheuristic",
      label="局部搜索",
      description="在初始解上继续改进；空=关闭",
      type="enum",
      recommended=True,
      default="GUIDED_LOCAL_SEARCH",
      options=[
        FactorOption(value="GUIDED_LOCAL_SEARCH", label="引导局部搜索（推荐）", recommended=True),
        FactorOption(value="SIMULATED_ANNEALING", label="模拟退火"),
        FactorOption(value="TABU_SEARCH", label="禁忌搜索"),
        FactorOption(value="", label="关闭（更快）"),
      ],
    ),
    FactorDefinition(
      key="timeLimitSeconds",
      label="求解时限（秒）",
      description="越大越可能更优，但管理端试算建议 ≤ 8",
      type="number",
      recommended=True,
      min=0.1,
      max=120,
      step=0.5,
      default=2.0,
    ),
    FactorDefinition(
      key="travelTimeWeight",
      label="行驶时间权重",
      description="主目标系数；通常保持 1",
      type="number",
      recommended=True,
      min=0,
      max=10,
      step=0.1,
      default=1.0,
    ),
    FactorDefinition(
      key="distanceWeight",
      label="直线距离权重",
      description="有坐标时与时间混合；0 表示忽略直线距离",
      type="number",
      recommended=True,
      min=0,
      max=10,
      step=0.1,
      default=0.0,
    ),
    FactorDefinition(
      key="returnToDepot",
      label="回到酒店",
      description="结果是否包含回程；一日游展示建议关闭",
      type="boolean",
      recommended=True,
      default=False,
    ),
    FactorDefinition(
      key="enableTimeWindows",
      label="启用开闭馆时间窗",
      description="按节点 windowStart/windowEnd 约束到达时刻",
      type="boolean",
      recommended=True,
      default=False,
    ),
  ]
  return FactorCatalogResponse(presets=presets, factors=factors)


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
  """
  计算两点球面距离（米）。

  Args:
      lat1: 起点纬度
      lng1: 起点经度
      lat2: 终点纬度
      lng2: 终点经度

  Returns:
      距离米数
  """
  r = 6371000.0
  p1, p2 = math.radians(lat1), math.radians(lat2)
  dphi = math.radians(lat2 - lat1)
  dlmb = math.radians(lng2 - lng1)
  a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
  return 2 * r * math.asin(math.sqrt(a))


def _estimate_duration_matrix(nodes: list) -> list[list[int]]:
  """
  用 Haversine + 假定 25km/h 估速生成分钟矩阵。

  Args:
      nodes: RouteNode 列表，须含 lat/lng

  Returns:
      N×N 分钟矩阵

  Raises:
      ValueError: 缺少坐标
  """
  n = len(nodes)
  matrix = [[0] * n for _ in range(n)]
  for i in range(n):
    if nodes[i].lat is None or nodes[i].lng is None:
      raise ValueError(f"节点 {nodes[i].id} 缺少 lat/lng，且未提供 durationMatrix")
    for j in range(n):
      if i == j:
        continue
      meters = _haversine_meters(
        float(nodes[i].lat),
        float(nodes[i].lng),
        float(nodes[j].lat),
        float(nodes[j].lng),
      )
      # 约 25km/h ≈ 416.7 m/min
      minutes = max(1, int(round(meters / 416.7)))
      matrix[i][j] = minutes
  return matrix


def _resolve_options(raw: SolveOptions) -> SolveOptions:
  """
  合并预设与显式字段。

  Args:
      raw: 请求中的 options

  Returns:
      生效后的 SolveOptions
  """
  if raw.preset and raw.preset in PRESET_OPTIONS:
    merged = deepcopy(PRESET_OPTIONS[raw.preset])
    data = raw.model_dump(exclude_unset=True)
    data.pop("preset", None)
    return merged.model_copy(update=data)
  return raw


def _build_cost_matrix(
  travel: list[list[int]],
  nodes: list,
  travel_w: float,
  distance_w: float,
) -> list[list[int]]:
  """
  按权重混合行驶时间与直线距离，生成整数代价矩阵。

  Args:
      travel: 行驶分钟矩阵
      nodes: 节点
      travel_w: 时间权重
      distance_w: 距离权重

  Returns:
      加权后的整数矩阵
  """
  n = len(travel)
  out = [[0] * n for _ in range(n)]
  for i in range(n):
    for j in range(n):
      if i == j:
        continue
      cost = travel_w * travel[i][j]
      if distance_w > 0 and nodes[i].lat is not None and nodes[j].lat is not None:
        meters = _haversine_meters(
          float(nodes[i].lat),
          float(nodes[i].lng),
          float(nodes[j].lat),
          float(nodes[j].lng),
        )
        cost += distance_w * (meters / 100.0)
      out[i][j] = max(0, int(round(cost)))
  return out


def solve_route(req: SolveRouteRequest) -> SolveRouteResponse:
  """
  执行 Routing 求解。

  Args:
      req: 求解请求

  Returns:
      SolveRouteResponse

  Raises:
      ValueError: 矩阵尺寸不合法、策略未知或无可行解
  """
  started = time.perf_counter()
  nodes = req.nodes
  n = len(nodes)
  opts = _resolve_options(req.options)

  if req.durationMatrix is not None:
    if len(req.durationMatrix) != n or any(len(row) != n for row in req.durationMatrix):
      raise ValueError("durationMatrix 必须为 N×N")
    travel = req.durationMatrix
    matrix_source = "provided"
  else:
    travel = _estimate_duration_matrix(nodes)
    matrix_source = "haversine_estimate"

  cost_matrix = _build_cost_matrix(
    travel, nodes, opts.travelTimeWeight, opts.distanceWeight
  )

  if n == 1:
    return SolveRouteResponse(
      order=[0],
      orderIds=[nodes[0].id],
      orderNames=[nodes[0].name],
      totalCost=0,
      appliedFactors=_describe_factors(opts, matrix_source),
      matrixSource=matrix_source,  # type: ignore[arg-type]
      solveMs=int((time.perf_counter() - started) * 1000),
    )

  manager = pywrapcp.RoutingIndexManager(n, 1, 0)
  routing = pywrapcp.RoutingModel(manager)

  def transit_callback(from_index: int, to_index: int) -> int:
    """
    弧代价回调。

    Args:
        from_index: 内部起点
        to_index: 内部终点

    Returns:
        整数代价
    """
    a = manager.IndexToNode(from_index)
    b = manager.IndexToNode(to_index)
    return int(cost_matrix[a][b])

  transit_id = routing.RegisterTransitCallback(transit_callback)
  routing.SetArcCostEvaluatorOfAllVehicles(transit_id)

  if opts.enableTimeWindows:
    def time_callback(from_index: int, to_index: int) -> int:
      """
      时间维度：行驶 + 起点停留。

      Args:
          from_index: 内部起点
          to_index: 内部终点

      Returns:
          分钟增量
      """
      a = manager.IndexToNode(from_index)
      b = manager.IndexToNode(to_index)
      return int(travel[a][b] + nodes[a].stayMinutes)

    time_id = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
      time_id,
      int(opts.waitingSlackMinutes),
      24 * 60,
      False,
      "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")
    for node_idx, node in enumerate(nodes):
      index = manager.NodeToIndex(node_idx)
      if node.windowStart is not None and node.windowEnd is not None:
        time_dim.CumulVar(index).SetRange(int(node.windowStart), int(node.windowEnd))
    time_dim.CumulVar(routing.Start(0)).SetRange(
      int(opts.depotStartMinutes),
      int(opts.depotStartMinutes) + 60,
    )

  params = pywrapcp.DefaultRoutingSearchParameters()
  limit = max(0.1, float(opts.timeLimitSeconds))
  params.time_limit.seconds = int(limit)
  params.time_limit.nanos = int(round((limit - int(limit)) * 1_000_000_000))

  first = FIRST_SOLUTION_MAP.get(opts.firstSolution)
  if first is None:
    raise ValueError(f"未知 firstSolution: {opts.firstSolution}")
  params.first_solution_strategy = first

  if opts.metaheuristic:
    meta = METAHEURISTIC_MAP.get(opts.metaheuristic)
    if meta is None:
      raise ValueError(f"未知 metaheuristic: {opts.metaheuristic}")
    params.local_search_metaheuristic = meta

  solution = routing.SolveWithParameters(params)
  if solution is None:
    raise ValueError("无可行解：请放宽时间窗或检查矩阵")

  order: list[int] = []
  index = routing.Start(0)
  total = 0
  while not routing.IsEnd(index):
    order.append(manager.IndexToNode(index))
    previous = index
    index = solution.Value(routing.NextVar(index))
    total += routing.GetArcCostForVehicle(previous, index, 0)
  order.append(manager.IndexToNode(index))

  if not opts.returnToDepot and len(order) > 1 and order[-1] == 0:
    last_leg = cost_matrix[order[-2]][0]
    order = order[:-1]
    total = max(0, total - last_leg)

  return SolveRouteResponse(
    order=order,
    orderIds=[nodes[i].id for i in order],
    orderNames=[nodes[i].name for i in order],
    totalCost=int(total),
    appliedFactors=_describe_factors(opts, matrix_source),
    matrixSource=matrix_source,  # type: ignore[arg-type]
    solveMs=int((time.perf_counter() - started) * 1000),
  )


def _describe_factors(opts: SolveOptions, matrix_source: str) -> list[AppliedFactor]:
  """
  生成应用到本次求解的因子说明列表。

  Args:
      opts: 生效选项
      matrix_source: 矩阵来源

  Returns:
      AppliedFactor 列表
  """
  return [
    AppliedFactor(key="preset", label="预设", value=str(opts.preset or "custom")),
    AppliedFactor(key="firstSolution", label="初始解策略", value=opts.firstSolution),
    AppliedFactor(
      key="metaheuristic",
      label="局部搜索",
      value=opts.metaheuristic or "(关闭)",
    ),
    AppliedFactor(
      key="timeLimitSeconds",
      label="时限(秒)",
      value=str(opts.timeLimitSeconds),
    ),
    AppliedFactor(
      key="travelTimeWeight",
      label="时间权重",
      value=str(opts.travelTimeWeight),
    ),
    AppliedFactor(
      key="distanceWeight",
      label="距离权重",
      value=str(opts.distanceWeight),
    ),
    AppliedFactor(
      key="enableTimeWindows",
      label="时间窗",
      value="on" if opts.enableTimeWindows else "off",
    ),
    AppliedFactor(key="matrixSource", label="矩阵来源", value=matrix_source),
  ]
