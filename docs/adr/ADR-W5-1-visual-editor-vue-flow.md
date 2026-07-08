# ADR-W5-1：Visual 编排编辑器技术选型

**状态**：已采纳  
**日期**：2026-07-08  
**关联**：[AI流程编排路线图 § Phase W5](../AI流程编排路线图.md)

## 背景

Phase W5 需在 Web 管理端提供 DAG 可视化编排（拖拽节点、连线、校验、沙箱预览、draft → published）。项目 Web 管理端为 **Vue 3 + Ant Design Vue**，早期文档曾写 React Flow，与主栈不一致。

## 决策

| 领域 | 选型 |
|------|------|
| 画布 | **Vue Flow**（`@vue-flow/core` + background / controls / minimap） |
| 图 JSON | `@douxing/shared` 的 `WorkflowGraphDefinition`（nodes + edges，`schemaVersion: 1`） |
| 节点表单 | Ant Design Vue 表单 + Tool 元数据（后续可接 JSON Schema） |
| 校验 | `validateWorkflowGraph()`（shared 纯函数）；server 发布前二次校验 |
| 持久化 | `workflow_templates.graph_def` + `graph_publish_status`（draft / published） |
| 预览 | 复用 `POST /api/admin/plan-sessions/sandbox-run`（不写生产 routes） |

## 理由

1. **同栈**：无需为单页引入 React 运行时。
2. **能力对等**：Vue Flow 交互模型源自 React Flow，社区案例（工作流编辑器）成熟。
3. **类型共享**：图定义与校验在 `@douxing/shared`，Web / Server / 未来 ai-service 编译器可复用。
4. **渐进落地**：运行时仍用 `plan_default.py` 硬编码图；W5 先完成「可视化 + 存储 + 校验」，LangGraph 动态编译列为后续。

## 不采纳

- **React Flow**：双栈维护成本高。
- **嵌入 Dify/Coze**：双栈运维，与 Node Tool 权威冲突（见路线图 §10）。

## 节点面板范围

- **17 个 Agent Tool**（与 `packages/server/src/agent/tools/index.ts` 一致）
- **编排虚拟节点**：memory / transit 子图、intent 条件路由、6 条 intent 分支
- **参考默认图**：`buildDefaultPlanDefaultGraph()` 与 `plan_default.py` 主拓扑等价

## 后果

- 新增依赖：`@vue-flow/core` 等（仅 `@douxing/web`）
- DB 迁移：`0038_workflow_template_graph.sql`
- 路由：`/workflow-templates/:id/editor`（权限 `data:analytics:view`）
