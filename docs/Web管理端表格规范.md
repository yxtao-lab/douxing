# Web 管理端表格规范

> **适用范围**：`packages/web` 全部数据列表页（业务、系统、监控、日志、会员、数据分析内嵌表等）。  
> **代码约束**：`.cursor/rules/web-admin-table-filter.mdc`、`.cursor/rules/web-admin-table-actions.mdc`（Agent 开发时自动引用）。  
> **最后更新**：2026-06-23

---

## 1. 组件与文件

| 组件 / 工具 | 路径 | 说明 |
|-------------|------|------|
| `DouxingAdminTable` | `packages/web/src/components/DouxingAdminTable.vue` | 统一表格；列宽拖动、空值占位、分页文案 |
| `AdminSearchBar` | `packages/web/src/components/admin/AdminSearchBar.vue` | 筛选栏（搜索/重置） |
| `AdminToolbar` | `packages/web/src/components/admin/AdminToolbar.vue` | 工具栏（左/右插槽） |
| `AdminTableExportButton` | `packages/web/src/components/admin/AdminTableExportButton.vue` | 报表导出 |
| `TableActionBar` / `TableActionButton` | `packages/web/src/components/admin/` | 操作列按钮 |
| `PageContainer` | `packages/web/src/layouts/components/PageContainer.vue` | 页面容器（`admin` 布局） |
| `useServerTablePagination` | `packages/web/src/composables/useServerTablePagination.ts` | 服务端分页 |
| `fetchAllPaginatedRows` | `packages/web/src/utils/fetchAllPaginatedRows.ts` | 导出前拉全量 |
| `adminTableExport` | `packages/web/src/utils/adminTableExport.ts` | XLSX 导出、`AdminExportColumn` |
| `adminTableColumns` | `packages/web/src/utils/adminTableColumns.ts` | 列宽、`formatAdminTableCell`、空值占位 |
| 列表样式 | `packages/web/src/styles/admin-page.css` | 表格/筛选/操作列样式 |

---

## 2. 表格基础

- 数据列表**必须**使用 `DouxingAdminTable`，禁止裸 `a-table`（含分析页内嵌小表）。
- 列定义推荐 `computed` + `width`；列宽默认可拖动，单列禁用 `{ resizable: false }`，整表 `:column-resizable="false"`。
- 分析页内嵌表可设 `:auto-body-scroll="false"` 避免与外层滚动冲突。

### 2.1 空值占位

| 规则 | 说明 |
|------|------|
| 占位符 | 统一为 `-`（常量 `ADMIN_TABLE_EMPTY_PLACEHOLDER`） |
| 判定 | `null` / `undefined` / 空白字符串 / 空数组 |
| 表格展示 | `DouxingAdminTable` 对有 `dataIndex` 或 `customRender` 的列自动注入 |
| 导出 | `formatAdminTableCell()` 与展示一致 |
| `#bodyCell` | 须手动调用 `formatAdminTableCell()` 或 `ADMIN_TABLE_EMPTY_PLACEHOLDER` |
| 禁止 | 列定义中手写 `|| '-'`、`?? '-'` |
| 例外 | 状态 Tag、开关等有业务语义的非空展示不受约束 |

```typescript
import {
  ADMIN_TABLE_EMPTY_PLACEHOLDER,
  formatAdminTableCell,
} from '@/utils/adminTableColumns';
```

---

## 3. 筛选栏

- 有筛选需求时**必须**使用 `PageContainer admin` + `#search` 插槽 + `AdminSearchBar`。
- 筛选项：`a-form-item` + `label`，宽度约 `160px`～`280px`；日期范围 `value-format="YYYY-MM-DD"`。
- 禁止表格上方自定义 `a-space` / 裸 `a-input-search` 筛选条。

| 场景 | 查询触发 | 数据加载 |
|------|----------|----------|
| 服务端分页 | `@search="reload"` `@reset="resetSearch"` | `useServerTablePagination` + 筛选 ref |
| 全量/树形 | `@search="load"` `@reset="resetSearch"` | 页面内 `load()` |

`resetSearch` 须清空所有筛选 ref（含日期范围）后再加载。

---

## 4. 报表导出

所有 `DouxingAdminTable` 列表**必须**提供 `AdminTableExportButton`（含字典双表、数据分析内嵌表）。

| 项 | 约定 |
|----|------|
| 按钮位置 | `AdminToolbar` `#right`，位于刷新按钮**左侧**；内嵌表可放卡片 `#extra` 或子卡片标题栏 |
| 表头 | 列 `title` 使用 `t('...')`，随 UI 语言变化 |
| 单元格 | 与表格展示一致；复杂列用 `exportValue`（`AdminExportColumn`） |
| 操作列 | `key: 'action'` 自动排除 |
| 服务端分页 | `:fetch-rows` + `fetchAllPaginatedRows`，按**当前筛选**拉全量 |
| 树形表 | `flatten-tree` |
| 格式 | **XLSX**（列宽自适应、换行、冻结表头） |
| 文件名 | `name-key` 为 i18n 键；`{t(nameKey)}-{YYYY-MM-DD-HHmmss}.xlsx` |
| 文案 | `common.exportReport` / `exportEmpty` / `exportSuccess` / `exportFailed`（shared） |

```vue
<AdminTableExportButton
  :columns="columns"
  :fetch-rows="fetchExportRows"
  name-key="web.orders"
/>
```

**`name-key` 示例**：`web.orders`、`web.checkins`、`system.exportDictTypes`、`analytics.trendsTitle`。

---

## 5. 操作列

- 统一 `TableActionBar` + `TableActionButton`；样式见 `admin-page.css`。
- 详见 `.cursor/rules/web-admin-table-actions.mdc`。

---

## 6. 已落地页面

| 模块 | 页面 | 筛选 / 导出 name-key |
|------|------|----------------------|
| 订单 | `OrdersView` | keyword, orderType, status, userId, date · `web.orders` |
| 打卡 | `CheckInsView` | keyword, userId, routeId, city, date · `web.checkins` |
| 路线 | `RoutesView` | keyword, status, creator, date · `web.routes` |
| 景点 | `AttractionsManageView` | keyword · `web.attractionsManage` |
| 待审景点 | `AttractionsPendingView` | keyword, city, category, source, coord, date · `web.attractionsPending` |
| 玩法动线 | `PlaybooksManageView` | keyword, status · `web.playbooksManage` |
| 操作/登录日志 | `LogOperView` / `LogLoginView` | keyword, status, date · `web.logOper` / `web.logLogin` |
| 系统 | `System*View` | 各模块筛选 · `web.sys*` / `system.exportDict*` |
| 监控 | `Monitor*View` | keyword 等 · `web.monitor*` |
| 会员 | `Membership*View` | keyword, level 等 · `web.membership*` |
| 数据分析 | `AnalyticsDashboardView` | 趋势表 / 城市榜 · `analytics.trendsTitle` / `analytics.cityRankTitle` |

暂不强制筛选栏：`MonitorDataView`、`MonitorServerView`、`MonitorCacheView`（统计/监控概览页）。

---

## 7. 后端列表筛选（新增 API 时）

- 路由层：`packages/server/src/utils/admin-list-filter.ts`
- 参数命名与前端 `fetchXxxPage` 一致（`keyword`、`status`、`dateStart`、`dateEnd` 等）
- 错误文案走 `ApiMessageKey`（见 [国际化.md](./国际化.md)）

---

## 8. 相关文档

- [系统管理.md](./系统管理.md) — Web 管理端 RBAC 与页面路由
- [PC双平台分工.md](./PC双平台分工.md) — 管理端 vs PC 用户端表格差异
- [数据中台.md](./数据中台.md) — 数据分析看板与内嵌表导出
- [品牌视觉规范.md §14](./品牌视觉规范.md#14-web-管理后台品牌) — 管理端 UI 与组件
- [国际化.md](./国际化.md) — 表头、导出文件名、提示文案 i18n
