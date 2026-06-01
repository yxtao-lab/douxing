/**
 * 校验 JSONL 训练集并划分 train/val
 *
 * 用法：
 *   pnpm ml:validate-dataset
 *   pnpm ml:validate-dataset -- --input packages/ml-training/datasets/generated/raw.jsonl --split
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

const inputPath = resolve(
  repoRoot,
  argValue('--input', 'packages/ml-training/datasets/generated/raw.jsonl'),
);
const outDir = resolve(repoRoot, 'packages/ml-training/datasets');
const doSplit = args.includes('--split');
const valRatio = parseFloat(argValue('--val-ratio', '0.1'));

const { validateTrainingSample } = await import('../services/training-data.service.js');

const lines = readFileSync(inputPath, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);

const valid: TrainingSample[] = [];
let invalid = 0;

for (const line of lines) {
  try {
    const sample = JSON.parse(line) as TrainingSample;
    const result = validateTrainingSample(sample);
    if (result.ok) {
      valid.push(sample);
    } else {
      invalid++;
    }
  } catch {
    invalid++;
  }
}

console.log(`输入 ${lines.length} 条，有效 ${valid.length}，无效 ${invalid}`);

if (!doSplit) {
  process.exit(valid.length > 0 ? 0 : 1);
}

mkdirSync(outDir, { recursive: true });
const valCount = Math.max(1, Math.floor(valid.length * valRatio));
const valSet = valid.slice(0, valCount);
const trainSet = valid.slice(valCount);

const trainPath = resolve(outDir, 'train.jsonl');
const valPath = resolve(outDir, 'val.jsonl');

writeFileSync(trainPath, trainSet.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8');
writeFileSync(valPath, valSet.map((s) => JSON.stringify(s)).join('\n') + '\n', 'utf8');

console.log(`已写入 train: ${trainSet.length} → ${trainPath}`);
console.log(`已写入 val:   ${valSet.length} → ${valPath}`);
