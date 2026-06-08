# 兜行项目文档

| 文档 | 说明 |
|------|------|
| [公共组件.md](./公共组件.md) | **移动端可复用 Vue 组件**：功能、封装方式与用法 |
| [启动与部署流程.md](./启动与部署流程.md) | **开发/测试/生产启动命令、打包与部署流程总览** |
| [env-environments.md](./env-environments.md) | 环境文件说明与切换方式（`pnpm env:status`） |
| [deploy-production.md](./deploy-production.md) | 生产服务器（Debian 12）详细部署指南 |
| [ROADMAP.md](./ROADMAP.md) | 功能路线图：已实现 / 未实现 / 分步实施计划 |
| [下一步工作.md](./下一步工作.md) | **当前建议先做什么**（精简排期，不重复 ROADMAP 全文） |
| [后期待办.md](./后期待办.md) | **合规与资质类待办**（备案、支付、短信认证、公司注册等） |
| [开发记录-重难点与亮点.md](./开发记录-重难点与亮点.md) | 开发思考过程、亮点与重难点（覆盖 M0/A/B/C 已验收步骤；文首有阶段速查表） |
| [amap-geocoding.md](./amap-geocoding.md) | 高德 POI 搜索 / 地理编码 / **封面拉图** 接入与配置 |
| [代码解析与审核.md](./代码解析与审核.md) | **功能代码解析模板** + 实现原理 / 运行步骤 / Review 清单（含景点封面 POI 拉图示例） |
| [阿里云-兜行专属模型训练与部署.md](./阿里云-兜行专属模型训练与部署.md) | **专属模型**：DeepSeek 造数据 → PAI LoRA → 百炼推理 → Debian 接入 |
| [../scripts/app-native.md](../scripts/app-native.md) | iOS / Android 一键部署与单平台开发 |
| [../scripts/README.md](../scripts/README.md) | **scripts 目录**：各脚本用途与命令对照 |

## 阅读建议

- **产品 / 业务**：优先阅读详细设计文档第 1、4、5、14 章  
- **研发**：第 2、3、7、12 章 + ROADMAP 对照当前代码；踩坑与方案查「开发记录-重难点与亮点」；复用组件查「公共组件」  
- **运维 / 安全**：第 8、9、11 章  

日常开发脚本说明见 [../scripts/README.md](../scripts/README.md)。详细设计以仓库内 **Markdown 版** `docs/详细设计文档.md` 为准。
