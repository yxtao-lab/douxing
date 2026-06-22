/**
 * I2 · Step 35 PAI LoRA 微调前置验收
 *
 * 用法：
 *   pnpm --filter @douxing/server i2:pai-lora-cases
 *   pnpm --filter @douxing/server i2:pai-lora-cases -- --offline
 *   pnpm --filter @douxing/server i2:pai-lora-cases -- --verify-oss
 *   pnpm --filter @douxing/server i2:pai-lora-cases -- --min-train 2000
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TrainingSample } from '../services/training-data.service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');

const args = process.argv.slice(2);
function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

const offline = args.includes('--offline');
const verifyOss = args.includes('--verify-oss');
const minSeed = parseInt(argValue('--min-seed', '50'), 10);
const minTrain = parseInt(argValue('--min-train', '50'), 10);
const v01TrainTarget = 2000;

const mlRoot = resolve(repoRoot, 'packages/ml-training');
const seedPath = resolve(mlRoot, 'datasets/prompts-seed.jsonl');
const trainPath = resolve(mlRoot, 'datasets/train.jsonl');
const valPath = resolve(mlRoot, 'datasets/val.jsonl');
const loraConfigPath = resolve(mlRoot, 'configs/distill-qwen-7b-lora.yaml');
const datasetInfoPath = resolve(mlRoot, 'configs/dataset_info.snippet.json');

let failed = 0;

function fail(msg: string): void {
  console.error(`[FAIL] ${msg}`);
  failed += 1;
}

function pass(msg: string): void {
  console.log(`[PASS] ${msg}`);
}

function readJsonl(filePath: string): string[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

console.log('=== I2 · Step 35 PAI LoRA 微调验收 ===\n');

// 1. 种子覆盖
const seedLines = readJsonl(seedPath);
if (seedLines.length >= minSeed) {
  pass(`prompts-seed.jsonl ≥ ${minSeed} 条（当前 ${seedLines.length}）`);
} else {
  fail(`prompts-seed.jsonl 仅 ${seedLines.length} 条，需 ≥ ${minSeed}`);
}

// 2. 配置文件
for (const [label, p] of [
  ['LoRA 配置', loraConfigPath],
  ['dataset_info', datasetInfoPath],
] as const) {
  if (existsSync(p)) {
    pass(`${label} 存在`);
  } else {
    fail(`${label} 缺失: ${p}`);
  }
}

// 3. train/val 数量
const trainLines = readJsonl(trainPath);
const valLines = readJsonl(valPath);

if (trainLines.length >= minTrain) {
  pass(`train.jsonl ≥ ${minTrain} 条（当前 ${trainLines.length}）`);
} else {
  fail(`train.jsonl 仅 ${trainLines.length} 条，需 ≥ ${minTrain}（先 ml:generate-dataset + ml:validate-dataset -- --split）`);
}

if (valLines.length >= 1) {
  pass(`val.jsonl ≥ 1 条（当前 ${valLines.length}）`);
} else {
  fail('val.jsonl 为空');
}

if (trainLines.length > 0 && trainLines.length < v01TrainTarget) {
  console.log(`[WARN] v0.1 上线建议 train ≥ ${v01TrainTarget} 条，当前 ${trainLines.length}（试跑可继续）`);
}

// 4. 样本 schema 校验
const { validateTrainingSample } = await import('../services/training-data.service.js');

let trainInvalid = 0;
let valInvalid = 0;

for (const line of trainLines) {
  try {
    const sample = JSON.parse(line) as TrainingSample;
    const result = validateTrainingSample(sample);
    if (!result.ok) trainInvalid += 1;
  } catch {
    trainInvalid += 1;
  }
}

for (const line of valLines) {
  try {
    const sample = JSON.parse(line) as TrainingSample;
    const result = validateTrainingSample(sample);
    if (!result.ok) valInvalid += 1;
  } catch {
    valInvalid += 1;
  }
}

if (trainLines.length > 0 && trainInvalid === 0) {
  pass(`train 全部样本通过 Zod schema 校验（${trainLines.length} 条）`);
} else if (trainLines.length > 0) {
  fail(`train 有 ${trainInvalid} 条未通过 schema 校验`);
}

if (valLines.length > 0 && valInvalid === 0) {
  pass(`val 全部样本通过 Zod schema 校验（${valLines.length} 条）`);
} else if (valLines.length > 0) {
  fail(`val 有 ${valInvalid} 条未通过 schema 校验`);
}

// 5. OSS 校验（可选）
if (verifyOss && !offline) {
  await import('../config/env.js');
  const { getOssMlDatasetsPrefix, isOssEnabled } = await import('../config/oss.js');
  const { headOssObject } = await import('../services/oss-storage.service.js');

  if (!isOssEnabled()) {
    fail('OSS 未配置，无法 --verify-oss');
  } else {
    const prefix = getOssMlDatasetsPrefix();
    for (const name of ['train.jsonl', 'val.jsonl'] as const) {
      const key = `${prefix}${name}`;
      const meta = await headOssObject(key);
      if (meta && meta.size > 0) {
        pass(`OSS 对象存在: ${name}（${meta.size} bytes）`);
      } else {
        fail(`OSS 对象缺失: ${key}（执行 pnpm ml:upload-dataset）`);
      }
    }
  }
} else if (verifyOss && offline) {
  console.log('[INFO] --offline 跳过 OSS 校验');
}

console.log('');

if (failed > 0) {
  console.error(`I2 验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('=== I2 本地前置验收通过 ===\n');
console.log('PAI 控制台手动步骤（训练完成后勾选 Step 35）：');
console.log('  1. pnpm ml:generate-dataset（种子已扩充时可批量造数）');
console.log('  2. pnpm ml:validate-dataset -- --split');
console.log('  3. pnpm ml:upload-dataset（需 OSS_ENABLED=true）');
console.log('  4. PAI Model Gallery → DeepSeek-R1-Distill-Qwen-7B → LoRA SFT');
console.log('  5. 训练产出写入 OSS checkpoint 目录，确认可导入百炼（Step 36）');
console.log('');
console.log('详细操作：[docs/阿里云-兜行专属模型训练与部署.md]');
