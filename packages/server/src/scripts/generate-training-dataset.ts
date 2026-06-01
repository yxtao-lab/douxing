/**
 * 用 DeepSeek 批量生成 SFT 训练集（messages JSONL）
 *
 * 用法（仓库根目录）：
 *   pnpm ml:generate-dataset
 *   pnpm ml:generate-dataset -- --limit 20 --delay-ms 800
 *   pnpm ml:generate-dataset -- --seed ../../packages/ml-training/datasets/prompts-seed.jsonl
 *
 * 前置：.env 配置 DEEPSEEK_API_KEY；建议 docker compose up -d（MySQL 供 RAG）
 */

import { readFileSync, appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');

const args = process.argv.slice(2);
function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

const limit = parseInt(argValue('--limit', '9999'), 10);
const delayMs = parseInt(argValue('--delay-ms', '600'), 10);
const seedPath = resolve(
  repoRoot,
  argValue('--seed', 'packages/ml-training/datasets/prompts-seed.jsonl'),
);
const outDir = resolve(repoRoot, 'packages/ml-training/datasets/generated');
const outPath = resolve(outDir, 'raw.jsonl');

interface SeedRow {
  prompt: string;
  city?: string;
  days?: number;
  budget?: string;
  themes?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

await import('../config/env.js');

const { parseTravelIntent, buildIntentFromHistory } = await import(
  '../services/travel-intent.service.js'
);
const { retrieveAttractionsForPlanning } = await import(
  '../services/attraction-rag.service.js'
);
const { retrievePlaybooksForPlanning } = await import(
  '../services/playbook-rag.service.js'
);
const { generateRouteFromLlm } = await import('../services/llm-route-generator.service.js');
const { buildTrainingSample, validateTrainingSample } = await import(
  '../services/training-data.service.js'
);
const { hasDeepseekApiKey } = await import('../config/llm.js');

if (!hasDeepseekApiKey()) {
  console.error('未配置 DEEPSEEK_API_KEY，无法生成训练数据');
  process.exit(1);
}

if (!existsSync(seedPath)) {
  console.error(`种子文件不存在: ${seedPath}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const seeds: SeedRow[] = readFileSync(seedPath, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .map((line) => JSON.parse(line) as SeedRow)
  .slice(0, limit);

console.log(`读取种子 ${seeds.length} 条，输出: ${outPath}`);

let ok = 0;
let skip = 0;

for (let i = 0; i < seeds.length; i++) {
  const seed = seeds[i]!;
  const prompt = seed.prompt.trim();
  console.log(`[${i + 1}/${seeds.length}] ${prompt.slice(0, 48)}...`);

  try {
    const intent = buildIntentFromHistory(undefined, prompt, {
      days: seed.days,
      budget: seed.budget,
    });
    if (seed.city && !intent.city) {
      intent.city = seed.city;
      intent.cities = [seed.city];
    }
    if (seed.themes?.length) {
      intent.themes = seed.themes;
    }

    const ragCandidates = await retrieveAttractionsForPlanning({
      city: intent.city,
      themes: intent.themes,
      prompt,
      days: intent.days,
    });
    const playbookMatches = await retrievePlaybooksForPlanning({
      city: intent.city,
      themes: intent.themes,
      prompt,
    });

    const draft = await generateRouteFromLlm({
      prompt,
      intent,
      ragCandidates,
      playbookMatches,
      provider: 'deepseek',
      locale: 'zh-CN',
    });

    const sample = buildTrainingSample(prompt, draft, {
      intent,
      ragCandidates,
      playbookMatches,
      locale: 'zh-CN',
    });

    const validation = validateTrainingSample(sample, ragCandidates);
    if (!validation.ok) {
      console.warn(`  跳过: ${validation.errors.join('; ')}`);
      skip++;
      continue;
    }

    appendFileSync(outPath, `${JSON.stringify(sample)}\n`, 'utf8');
    ok++;
    console.log(`  已写入 (POI 命中 ${(validation.poiHitRate * 100).toFixed(0)}%)`);
  } catch (err) {
    console.warn(`  失败: ${err instanceof Error ? err.message : err}`);
    skip++;
  }

  if (i < seeds.length - 1 && delayMs > 0) {
    await sleep(delayMs);
  }
}

console.log(`\n完成: 成功 ${ok}，跳过/失败 ${skip}`);
console.log(`下一步: pnpm ml:validate-dataset -- --split`);
