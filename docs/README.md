# 兜行项目文档

| 文档 | 说明 |
|------|------|
| [详细设计文档.md](./详细设计文档.md) | 《兜行平台最终详细设计文档》V2.0 完整 Markdown 版 |
| [ROADMAP.md](./ROADMAP.md) | 功能路线图：已实现 / 未实现 / 分步实施计划 |

## 阅读建议

- **产品 / 业务**：优先阅读详细设计文档第 1、4、5、14 章  
- **研发**：第 2、3、7、12 章 + ROADMAP 对照当前代码  
- **运维 / 安全**：第 8、9、11 章  

## 重新生成详细设计 Markdown

若更新了 Word 原版，在项目根目录执行：

```bash
node scripts/format-design-doc.mjs
# 或指定 docx 路径：
node scripts/format-design-doc.mjs "e:/Desktop/详细设计文档.docx"
```

将自动：提取 Word → 生成 `docs/详细设计文档.md` → 排版后处理。

日常开发以仓库内 **Markdown 版** 为准，Word 文件作为归档来源。
