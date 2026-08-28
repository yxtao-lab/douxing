# @douxing/or-tools

兜行 monorepo 内对 **Python 版路径求解产品仓** 的封装。

| 项 | 内容 |
|----|------|
| 产品仓 | [yxtao-lab/python-route-solver](https://github.com/yxtao-lab/python-route-solver) |
| 本地路径 | `packages/or-tools/upstream`（git submodule） |
| 跟踪分支 | `douxing`（专供兜行；远端另有 `main`） |
| 运行时依赖 | PyPI [`ortools`](https://pypi.org/project/ortools/)（见 `upstream/requirements.txt`） |
| 语言 | **Python**（通过官方绑定调用 OR-Tools，日常定制算法用 Python 即可） |

> 已不再引用 C++ 源码仓 `yxtao-lab/route-solver`。若需改求解器内核，再单独使用该 C++ fork。

## 初始化

```bash
git submodule update --init --depth 1 packages/or-tools/upstream
pip install -r packages/or-tools/upstream/requirements.txt
```

```bash
pnpm --filter @douxing/or-tools info
pnpm --filter @douxing/or-tools upstream:status
```

## 运行示例

```bash
# 上游模板自带
pnpm --filter @douxing/or-tools example:basic

# 兜行一日行程（酒店 + POI）
pip install -r packages/or-tools/examples/requirements.txt
pnpm --filter @douxing/or-tools example:day-route
```

## 修改与提交

在 `upstream/`（`douxing` 分支）改 Python 代码后：

```bash
cd packages/or-tools/upstream
git add -A && git commit -m "feat: ..."
git push origin douxing

cd ../../..
git add packages/or-tools/upstream
git commit -m "chore(or-tools): 更新 python-route-solver 指针"
```

算法定制（策略、时间窗、矩阵）优先在 Python 层完成，见 `examples/solve_day_route.py`。
