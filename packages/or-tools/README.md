# @douxing/or-tools

兜行 monorepo 内对 **自有产品仓** [yxtao-lab/route-solver](https://github.com/yxtao-lab/route-solver) 的封装。

- 源码目录：`packages/or-tools/upstream`（git submodule）
- 跟踪分支：`douxing`（专供兜行系统；通用产品线仍可用远端 `stable`）
- 远程：**你的 fork**，不再指向 `google/or-tools`
- 许可：Apache-2.0（继承自 OR-Tools；产品仓需保留 LICENSE / NOTICE）

## 初始化

```bash
git submodule update --init --depth 1 packages/or-tools/upstream
```

```bash
pnpm --filter @douxing/or-tools info
pnpm --filter @douxing/or-tools upstream:status
```

## 修改内核代码（推到你的产品仓）

在 `upstream/` 内改完后：

```bash
cd packages/or-tools/upstream
git checkout -b feat/your-change
git add -A && git commit -m "feat: ..."
git push -u origin feat/your-change

cd ../../..
git add packages/or-tools/upstream
git commit -m "chore(or-tools): 更新 route-solver 指针"
```

## 与 Google 上游的关系

- **默认不同步** Google，避免影响你的独立产品。
- 若需参考官方更新：在产品仓临时 `git remote add google https://github.com/google/or-tools.git`，手动 cherry-pick，勿直接 merge 进默认分支 unless 你明确要跟。

本包不参与根目录业务 `pnpm build`；C++/Bazel 构建按 route-solver / OR-Tools 文档在本地进行。
