#!/usr/bin/env python3
"""
兜行一日行程顺序优化示例：酒店(depot) + 若干 POI。

依赖（官方预编译绑定，无需先编译 upstream C++）：
  pip install ortools

运行：
  python packages/or-tools/examples/solve_day_route.py
"""

from __future__ import annotations

from dataclasses import dataclass

from ortools.constraint_solver import pywrapcp, routing_enums_pb2


@dataclass(frozen=True)
class SolveOptions:
    """
    求解可调参数（定制化入口）。

    Attributes:
        time_limit_seconds: 求解时限（秒）；越大越可能找到更优解
        first_solution: 初始解策略名，见 FIRST_SOLUTION_MAP
        metaheuristic: 局部搜索元启发式名，见 METAHEURISTIC_MAP；空字符串表示关闭
        return_to_depot: 是否要求回到酒店（闭环）；False 更接近「逛完即结束」
    """

    time_limit_seconds: float = 2.0
    first_solution: str = "PATH_CHEAPEST_ARC"
    metaheuristic: str = "GUIDED_LOCAL_SEARCH"
    return_to_depot: bool = False


FIRST_SOLUTION_MAP = {
    "PATH_CHEAPEST_ARC": routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC,
    "SAVINGS": routing_enums_pb2.FirstSolutionStrategy.SAVINGS,
    "CHRISTOFIDES": routing_enums_pb2.FirstSolutionStrategy.CHRISTOFIDES,
    "PARALLEL_CHEAPEST_INSERTION": (
        routing_enums_pb2.FirstSolutionStrategy.PARALLEL_CHEAPEST_INSERTION
    ),
}

METAHEURISTIC_MAP = {
    "GUIDED_LOCAL_SEARCH": routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH,
    "SIMULATED_ANNEALING": routing_enums_pb2.LocalSearchMetaheuristic.SIMULATED_ANNEALING,
    "TABU_SEARCH": routing_enums_pb2.LocalSearchMetaheuristic.TABU_SEARCH,
    "GENERIC_TABU_SEARCH": routing_enums_pb2.LocalSearchMetaheuristic.GENERIC_TABU_SEARCH,
}


def build_demo_duration_matrix() -> tuple[list[str], list[list[int]]]:
    """
    构造演示用「分钟」耗时矩阵（不对称也可）。

    下标 0 = 酒店；其后为 POI。真实接入时应替换为兜行
    `buildDurationMatrix` 的结果（取整为 int）。

    Returns:
        names: 节点名称列表
        matrix: matrix[i][j] 表示从 i 到 j 的行驶分钟数
    """
    names = ["酒店", "西湖", "灵隐寺", "雷峰塔", "河坊街"]
    # 行=起点，列=终点；对角为 0
    matrix = [
        [0, 15, 35, 20, 12],
        [18, 0, 40, 10, 22],
        [38, 42, 0, 45, 30],
        [22, 12, 48, 0, 18],
        [14, 25, 28, 16, 0],
    ]
    return names, matrix


def solve_day_route(
    duration_matrix: list[list[int]],
    options: SolveOptions | None = None,
) -> tuple[list[int], int] | None:
    """
    用 OR-Tools Routing 求解一日访问顺序。

    Args:
        duration_matrix: N×N 整数代价矩阵（建议单位：分钟）；下标 0 为 depot（酒店）
        options: 求解策略；为 None 时使用默认 SolveOptions

    Returns:
        (order, total_cost)：
        - order 为节点下标序列（含起点酒店；若 return_to_depot 则末尾回到 0）
        - total_cost 为路径总代价
        无可行解时返回 None
    """
    opts = options or SolveOptions()
    n = len(duration_matrix)
    if n == 0:
        return [], 0
    if n == 1:
        return [0], 0

    manager = pywrapcp.RoutingIndexManager(n, 1, 0)
    routing = pywrapcp.RoutingModel(manager)

    def transit_callback(from_index: int, to_index: int) -> int:
        """
        返回弧代价；Routing 内部 index 需先映射到业务节点下标。

        Args:
            from_index: 求解器内部起点 index
            to_index: 求解器内部终点 index

        Returns:
            对应 duration_matrix 中的整数代价
        """
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(duration_matrix[from_node][to_node])

    transit_id = routing.RegisterTransitCallback(transit_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_id)

    params = pywrapcp.DefaultRoutingSearchParameters()
    # protobuf Duration.FromSeconds 需要整数秒；亚秒用 nanos
    limit = max(0.1, float(opts.time_limit_seconds))
    params.time_limit.seconds = int(limit)
    params.time_limit.nanos = int(round((limit - int(limit)) * 1_000_000_000))

    first = FIRST_SOLUTION_MAP.get(opts.first_solution)
    if first is None:
        raise ValueError(f"未知 first_solution: {opts.first_solution}")
    params.first_solution_strategy = first

    if opts.metaheuristic:
        meta = METAHEURISTIC_MAP.get(opts.metaheuristic)
        if meta is None:
            raise ValueError(f"未知 metaheuristic: {opts.metaheuristic}")
        params.local_search_metaheuristic = meta

    # Routing 默认求「从 depot 出发并回到 depot」的回路；
    # return_to_depot=False 时在结果里去掉末尾回程，更贴近一日游展示。
    solution = routing.SolveWithParameters(params)
    if solution is None:
        return None

    order: list[int] = []
    index = routing.Start(0)
    total = 0
    while not routing.IsEnd(index):
        order.append(manager.IndexToNode(index))
        previous = index
        index = solution.Value(routing.NextVar(index))
        total += routing.GetArcCostForVehicle(previous, index, 0)
    order.append(manager.IndexToNode(index))

    if not opts.return_to_depot and len(order) > 1 and order[-1] == 0:
        last_leg = duration_matrix[order[-2]][0]
        order = order[:-1]
        total = max(0, total - last_leg)

    return order, total


def apply_time_windows_example(
    routing: pywrapcp.RoutingModel,
    manager: pywrapcp.RoutingIndexManager,
    time_matrix: list[list[int]],
    windows: list[tuple[int, int]],
    depot_start_minutes: int = 9 * 60,
) -> None:
    """
    【定制示例】为各节点加时间窗（开闭馆），供后续完善时对照使用。

    本函数默认不被 main 调用；接入时在 solve_day_route 内注册 Transit 维度后调用。

    Args:
        routing: Routing 模型
        manager: Index 管理器
        time_matrix: 行驶时间矩阵（分钟）
        windows: 每个节点 [最早可到达, 最晚可到达]（当日分钟数，如 9:00=540）
        depot_start_minutes: 从酒店出发的时刻

    Returns:
        None（副作用：向 routing 注册 Time 维度与窗约束）
    """
    def time_callback(from_index: int, to_index: int) -> int:
        """
        行驶时间回调。

        Args:
            from_index: 内部起点
            to_index: 内部终点

        Returns:
            分钟数
        """
        a = manager.IndexToNode(from_index)
        b = manager.IndexToNode(to_index)
        return int(time_matrix[a][b])

    time_id = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(
        time_id,
        30,  # 允许在节点等待的松弛（分钟）——可按产品调大/调小
        24 * 60,
        False,
        "Time",
    )
    time_dim = routing.GetDimensionOrDie("Time")
    for node, (start, end) in enumerate(windows):
        index = manager.NodeToIndex(node)
        time_dim.CumulVar(index).SetRange(start, end)
    # 出发时刻
    time_dim.CumulVar(routing.Start(0)).SetRange(depot_start_minutes, depot_start_minutes + 60)


def main() -> None:
    """
    运行演示：打印默认策略下的一日顺序，并提示可调参数。

    Returns:
        None
    """
    names, matrix = build_demo_duration_matrix()
    options = SolveOptions(
        time_limit_seconds=2.0,
        first_solution="PATH_CHEAPEST_ARC",
        metaheuristic="GUIDED_LOCAL_SEARCH",
        return_to_depot=False,
    )
    result = solve_day_route(matrix, options)
    if result is None:
        print("无可行解，请检查矩阵或放宽约束。")
        return

    order, total = result
    path = " → ".join(names[i] for i in order)
    print("=== 兜行一日顺序（OR-Tools Routing 示例）===")
    print(f"顺序: {path}")
    print(f"下标: {order}")
    print(f"总行驶约: {total} 分钟")
    print()
    print("定制入口见 SolveOptions / FIRST_SOLUTION_MAP / METAHEURISTIC_MAP，")
    print("以及 apply_time_windows_example（开闭馆时间窗）。")


if __name__ == "__main__":
    main()
