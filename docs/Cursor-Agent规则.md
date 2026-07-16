# Cursor Agent 规则索引

> **用途**：仓库根目录 `.cursor/rules/*.mdc` 为 Cursor / AI Agent 的持久化开发约束；人类可读全文见各专题文档。  
> **根配置**：`.cursorrules` 汇总基础规范并指向下列规则。  
**最后更新**：2026-07-16

---

## 规则一览

| 规则文件 | 生效范围 | 说明 | 人类可读文档 |
|----------|----------|------|--------------|
| `page-ui-standards.mdc` | **始终** | 新页面三端风格/布局、主题预留、组件复用与封装 | [品牌视觉规范.md](./品牌视觉规范.md) · [公共组件.md](./公共组件.md) · [PC双平台分工.md](./PC双平台分工.md) |
| `pc-c-web-b-split.mdc` | **始终** | **PC 仅 C 端；全部 B 端操作放 Web**（含 `/partner`） | [PC双平台分工.md §0](./PC双平台分工.md#0-端侧铁律必读) |
| `i18n-required.mdc` | **始终** | 移动端 + Web + 后端 API 国际化（zh-CN / en-US） | [国际化.md](./国际化.md) |
| `code-comments-required.mdc` | **始终** | 新增/修改函数须完整中文 JSDoc | `.cursor/rules/code-comments-required.mdc` |
| `display-datetime-format.mdc` | **始终** | 用户可见时间 `yyyy-mm-dd HH:mm:ss` | [PC双平台分工.md](./PC双平台分工.md) |
| `web-admin-table-filter.mdc` | `packages/web/**/*.vue` | 管理端表格、筛选栏、XLSX 导出、空值 `-` | [Web管理端表格规范.md](./Web管理端表格规范.md) |
| `web-admin-table-actions.mdc` | `packages/web/**/*.vue` | 管理端表格操作列按钮 | [Web管理端表格规范.md](./Web管理端表格规范.md) |
| `marketplace-roadmap-sync.mdc` | marketplace 相关 | M 线代码/文档变更时同步路线图 | [发单接单路线图.md §10](./发单接单路线图.md#10-维护约定) |

---

## 新页面开发（三端）

新增或改版页面时，Agent 须同时满足：

1. **风格与布局**：对齐同端已有页面；色彩/圆角/阴影只用设计 Token（见 [品牌视觉规范.md](./品牌视觉规范.md)）
2. **主题预留**：禁止硬编码与主题无关的色值；移动端根节点 `:class="themeClass"` + `useTheme()`
3. **国际化**：用户可见文案走 i18n；新页 `usePageTitle('nav.xxx')`（见 `i18n-required.mdc`）
4. **组件复用**：优先通用组件；跨页重复 ≥2 次须封装（见 `page-ui-standards.mdc`）

### 分端页面壳与必用组件

| 端 | 页面壳 | 常见通用组件 |
|----|--------|--------------|
| 移动端 `packages/mobile` | `class="page" :class="themeClass"` | `DouxingTabBar`、`DouxingEmptyState` |
| Web 管理端 `packages/web` | `PageContainer admin` | `DouxingAdminTable`、`AdminSearchBar`、`TableActionBar`；**B 端**另见 `/partner` |
| PC 用户端 `packages/pc` | `SubPageShell` | Tailwind `dx-*` Token、`AppLogo`；**仅 C 端**（见 `pc-c-web-b-split.mdc`） |

---

## 维护约定

- 新增 `.cursor/rules/*.mdc` 时，须在本文件登记，并在相关专题文档中交叉引用
- 规则内容与人类文档冲突时，以**代码库实际约定**为准，并同步修正规则或文档
- 修改 `packages/shared` i18n 后执行：`pnpm --filter @douxing/shared build`
