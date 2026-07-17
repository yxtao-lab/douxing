# Cursor Agent 规则索引

> **用途**：仓库根目录 `.cursor/rules/*.mdc` 为 Cursor / AI Agent 的持久化开发约束；人类可读全文见各专题文档。  
> **根配置**：`.cursorrules` 汇总基础规范并指向下列规则。  
**最后更新**：2026-07-17

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

## 精准化与人群定制开发规则（2026-07-17 录入）

> **关联**：[精准化与人群定制路线图.md](./精准化与人群定制路线图.md) · ROADMAP §9.10

涉及 `P-TAG-01` / `P-ONBOARD-01` / `P-INPUT-01` / `P-MEMORY-01` / `P-THEME-01` / `P-LIVE-01` / `P-DEMAND-01` / `P-PROFILE-01` 任一待办的开发，须遵守以下规则：

### 1. 标签双层体系

- **类型层**（`interestTags`，已有 12 slug）**不动**
- **场景层**（`sceneTags`，新增）存储中文值，展示用 `formatSceneTagLabel(tag, locale)`，禁止硬编码

### 2. 引导与画像字段

- `gender` / `ageRange` / `birthYear` 为**自愿填写**，必须支持「不愿透露」
- `ageVisibility` 控制可见性（0 不公开 / 1 仅年龄段 / 2 公开年龄）
- 不收集未成年人精确信息
- 引导流程必须**可跳过**，跳过时用默认值填充保证非空
- 画像字段写入与修改须记录审计日志

### 3. 推荐引擎

- 推荐结果须可解释（`matchScore` + `matchedScenes`）
- 避重过滤（P-MEMORY-01）默认开启，用户可切换策略
- 实时人数（P-LIVE-01）计数 < 5 时仅展示档位语义，不暴露具体数字

### 4. 群体主题（P-THEME-01）

- 每套主题定义一套 `--dx-*` CSS 变量覆盖，**不新增硬编码色值**
- 根据 `ageRange` + `gender` 自动推荐默认主题，用户手动选择优先
- 不强制绑定人群，支持自由切换
- 移动端全量支持 6 套；PC 支持 blue/teal/tech/mature；Web 管理端不接入

### 5. i18n 强制

- 场景标签、分类标签、主题名称、引导流程文案、推荐理由、隐私提示全部走 i18n
- 新增 i18n 资源文件：`scene-tags.ts` · `profile-tags.ts` · `theme-presets.ts`
- 修改 `packages/shared` i18n 后执行：`pnpm --filter @douxing/shared build`

### 6. 组件复用

- 标签选择器、引导面板、场景入口、规划定制面板、实时人数徽标、主题选择器须封装为公共组件（见 [公共组件.md](./公共组件.md) 精准化与人群定制组件章节）
- 跨页重复 ≥2 次或单块 >~80 行须抽组件

### 7. 隐私合规

- 涉及画像字段的功能须同步 [后期待办.md §9](./后期待办.md#9-精准化与人群定制隐私合规2026-07-17-录入) 隐私政策
- `P-PROFILE-01` 同龄人社交依赖隐私政策更新 + 未成年人保护条款
- 用户可一键清除画像重置为默认（`DELETE /api/users/me/persona`）

---

## 维护约定

- 新增 `.cursor/rules/*.mdc` 时，须在本文件登记，并在相关专题文档中交叉引用
- 规则内容与人类文档冲突时，以**代码库实际约定**为准，并同步修正规则或文档
- 修改 `packages/shared` i18n 后执行：`pnpm --filter @douxing/shared build`

**最后更新**：2026-07-17（新增精准化与人群定制开发规则）
