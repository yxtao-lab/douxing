/**
 * I2 · 上传 train/val 至阿里云 OSS，并写入 PAI 任务 manifest
 *
 * 用法（仓库根目录）：
 *   pnpm ml:upload-dataset
 *   pnpm ml:upload-dataset -- --version v0.1 --dry-run
 *
 * 前置：.env 配置 OSS_ENABLED=true 及 OSS_* 密钥
 */

import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');

const args = process.argv.slice(2);
function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

const version = argValue('--version', 'v0.1');
const dryRun = args.includes('--dry-run');
const datasetsDir = resolve(repoRoot, 'packages/ml-training/datasets');
const trainPath = resolve(datasetsDir, 'train.jsonl');
const valPath = resolve(datasetsDir, 'val.jsonl');
const trainPaiPath = resolve(datasetsDir, 'train-pai.jsonl');
const valPaiPath = resolve(datasetsDir, 'val-pai.jsonl');
const manifestDir = resolve(repoRoot, 'packages/ml-training/manifests');
const manifestPath = resolve(manifestDir, `pai-job-${version}.json`);

await import('../config/env.js');

const {
  getOssBucket,
  getOssMlCheckpointsPrefix,
  getOssMlDatasetsPrefix,
  isOssEnabled,
} = await import('../config/oss.js');

function assertFileExists(filePath: string): void {
  try {
    statSync(filePath);
  } catch {
    console.error(`文件不存在: ${filePath}`);
    process.exit(1);
  }
}

assertFileExists(trainPath);
assertFileExists(valPath);

const { convertJsonlToPaiAlpaca } = await import('../services/training-data-pai-format.service.js');

const trainCount = convertJsonlToPaiAlpaca(trainPath, trainPaiPath);
const valCount = convertJsonlToPaiAlpaca(valPath, valPaiPath);

console.log(`train: ${trainCount} 条 → ${trainPath}`);
console.log(`val:   ${valCount} 条 → ${valPath}`);
console.log(`train-pai (Alpaca): ${trainCount} 条 → ${trainPaiPath}`);
console.log(`val-pai (Alpaca):   ${valCount} 条 → ${valPaiPath}`);

if (trainCount < 1) {
  console.error('train.jsonl 为空，请先执行 pnpm ml:generate-dataset && pnpm ml:validate-dataset -- --split');
  process.exit(1);
}

const datasetsPrefix = getOssMlDatasetsPrefix();
const checkpointsPrefix = getOssMlCheckpointsPrefix();
const trainKey = `${datasetsPrefix}train.jsonl`;
const valKey = `${datasetsPrefix}val.jsonl`;
/** PAI Model Gallery 请使用 Alpaca 格式文件 */
const trainPaiKey = `${datasetsPrefix}train-pai.jsonl`;
const valPaiKey = `${datasetsPrefix}val-pai.jsonl`;

const bucket = getOssBucket() || 'YOUR_OSS_BUCKET';
function ossUri(key: string): string {
  return `oss://${bucket}/${key.replace(/^\//, '')}`;
}

const manifest = {
  version,
  createdAt: new Date().toISOString(),
  baseModel: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
  finetuningType: 'lora',
  dataset: {
    train: ossUri(trainKey),
    val: ossUri(valKey),
    /** PAI 控制台训练集请填此路径（Alpaca：instruction/input/output） */
    trainPai: ossUri(trainPaiKey),
    valPai: ossUri(valPaiKey),
    trainCount,
    valCount,
  },
  checkpointOutput: ossUri(checkpointsPrefix),
  hyperparams: {
    num_train_epochs: 3,
    learning_rate: 1e-4,
    seq_length: 8192,
    per_device_train_batch_size: 1,
    lora_rank: 16,
    warmup_ratio: 0.1,
  },
  configFile: 'packages/ml-training/configs/distill-qwen-7b-lora.yaml',
  paiConsole: 'https://pai.console.aliyun.com/',
  notes:
    'PAI Model Gallery → DeepSeek-R1-Distill-Qwen-7B → LoRA SFT；训练集用 dataset.trainPai（Alpaca），seq_length≥8192，batch=1',
};

if (dryRun) {
  console.log('\n[dry-run] 将上传至 OSS：');
  console.log(`  ${manifest.dataset.train}`);
  console.log(`  ${manifest.dataset.val}`);
  console.log(`  [PAI 请用] ${manifest.dataset.trainPai}`);
  console.log(`  [PAI 请用] ${manifest.dataset.valPai}`);
  console.log(`  checkpoint 输出: ${manifest.checkpointOutput}`);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`\n[dry-run] manifest 已写入: ${manifestPath}`);
  process.exit(0);
}

if (!isOssEnabled()) {
  console.error('OSS 未启用。请在 .env 设置 OSS_ENABLED=true 及 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_BUCKET');
  process.exit(1);
}

const { uploadLocalFileToOss } = await import('../services/oss-storage.service.js');

console.log(`\n上传至 Bucket: ${getOssBucket()}`);

try {
  await uploadLocalFileToOss(trainPath, trainKey);
  console.log(`[OK] train → ${manifest.dataset.train}`);

  await uploadLocalFileToOss(valPath, valKey);
  console.log(`[OK] val   → ${manifest.dataset.val}`);

  await uploadLocalFileToOss(trainPaiPath, trainPaiKey);
  console.log(`[OK] train-pai → ${manifest.dataset.trainPai}`);

  await uploadLocalFileToOss(valPaiPath, valPaiKey);
  console.log(`[OK] val-pai   → ${manifest.dataset.valPai}`);
} catch (err) {
  console.error('OSS 上传失败:', err instanceof Error ? err.message : err);
  process.exit(1);
}

mkdirSync(manifestDir, { recursive: true });
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`\nmanifest 已写入: ${manifestPath}`);
console.log('\n下一步：打开 PAI Model Gallery，按 manifest 中的 OSS 路径提交 LoRA 训练。');
console.log('验收：pnpm --filter @douxing/server i2:pai-lora-cases -- --verify-oss');
