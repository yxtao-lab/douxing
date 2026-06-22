# 兜行 ML 训练数据与配置

> **完整操作流程（阿里云 PAI + 百炼）** 见：  
> **[docs/阿里云-兜行专属模型训练与部署.md](../../docs/阿里云-兜行专属模型训练与部署.md)**

## 快速命令

> 根目录执行；npm 用户将 `pnpm` 改为 `npm run`。见 [docs/包管理与命令.md](../../docs/包管理与命令.md)。

```bash
# 根目录 — 生成训练数据（需 DEEPSEEK_API_KEY + MySQL）
pnpm ml:generate-dataset
pnpm ml:generate-dataset -- --limit 50 --delay-ms 800

# 校验并划分 train/val
pnpm ml:validate-dataset -- --split

# I2 Step 35 — 上传 OSS + 生成 PAI manifest（需 OSS_ENABLED=true）
pnpm ml:upload-dataset
pnpm ml:upload-dataset -- --dry-run

# I2 验收（种子/配置/schema；可选 --verify-oss）
pnpm --filter @douxing/server i2:pai-lora-cases
```

## 目录

```text
datasets/
  prompts-seed.jsonl      # 种子 prompt（≥50 条，I2 前已扩充）
  generated/raw.jsonl     # DeepSeek 生成结果
  train.jsonl / val.jsonl # 上传阿里云 OSS
configs/
  distill-qwen-7b-lora.yaml
  dataset_info.snippet.json
manifests/
  pai-job-v0.1.json       # ml:upload-dataset 产出（OSS 路径 + 超参）
```

## 基座模型

`deepseek-ai/DeepSeek-R1-Distill-Qwen-7B` — LoRA 微调，任务为 RAG 约束下的 POI JSON。
