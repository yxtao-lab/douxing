/**
 * C7-d · Step 37 plan_agent LoRA A/B 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server c7-d:plan-agent-ab-cases
 *   pnpm --filter @douxing/server c7-d:plan-agent-ab-cases -- --live
 *   pnpm --filter @douxing/server c7-d:plan-agent-ab-cases -- --live --limit 3
 *   pnpm --filter @douxing/server c7-d:plan-agent-ab-cases -- --live --report reports/c7-d-ab.json
 */

import '../config/env.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPlanAgentAbSuite, type PlanAgentAbSeed } from '../services/c7-d-plan-agent-ab.service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');

const args = process.argv.slice(2);

function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

const live = args.includes('--live');
const limit = parseInt(argValue('--limit', live ? '3' : '5'), 10);
const reportPath = argValue('--report', '');

const seeds: PlanAgentAbSeed[] = [
  { id: 'hz-3d', prompt: '杭州3天文化之旅，预算3000左右，想逛西湖和灵隐寺', days: 3 },
  { id: 'bj-5d', prompt: '北京5天亲子游，故宫、长城、环球影城，预算8000', days: 5 },
  { id: 'cd-2d', prompt: '成都2天美食休闲，宽窄巷子火锅', days: 2 },
  { id: 'sh-3d', prompt: '上海3天城市漫步，外滩陆家嘴，主题摄影', days: 3 },
  { id: 'xa-4d', prompt: '西安4天历史探秘，兵马俑回民街', days: 4 },
].slice(0, limit);

async function main() {
  console.log('=== C7-d · Step 37 plan_agent LoRA A/B 验收 ===\n');

  const graphPath = resolve(repoRoot, 'packages/ai-service/app/agent/graph.py');
  const report = await runPlanAgentAbSuite(seeds, {
    live,
    graphPath,
    baselineProvider: 'deepseek',
    challengerProvider: 'douxing',
  });

  console.log(`模式: ${report.mode}`);
  for (const note of report.notes) {
    console.log(`  · ${note}`);
  }

  if (report.mode === 'live') {
    const b = report.baseline;
    const c = report.challenger;
    console.log('\n--- 基线 deepseek ---');
    console.log(
      `  Schema ${(b.schemaPassRate * 100).toFixed(0)}% · POI ${(b.avgPoiHitRate * 100).toFixed(0)}% · 均延迟 ${b.avgLatencyMs.toFixed(0)}ms`,
    );
    for (const item of b.cases) {
      console.log(
        `  [${item.ok ? 'OK' : 'FAIL'}] ${item.id} provider=${item.llmProvider ?? '-'} ${item.routeName?.slice(0, 20) ?? item.error ?? ''}`,
      );
    }
    console.log('\n--- 挑战者 douxing ---');
    console.log(
      `  Schema ${(c.schemaPassRate * 100).toFixed(0)}% · POI ${(c.avgPoiHitRate * 100).toFixed(0)}% · 均延迟 ${c.avgLatencyMs.toFixed(0)}ms`,
    );
    for (const item of c.cases) {
      console.log(
        `  [${item.ok ? 'OK' : 'FAIL'}] ${item.id} provider=${item.llmProvider ?? '-'} ${item.routeName?.slice(0, 20) ?? item.error ?? ''}`,
      );
    }
  }

  if (reportPath) {
    const abs = resolve(repoRoot, reportPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n报告已写入 ${abs}`);
  }

  console.log('');
  if (!report.pass) {
    console.error('=== C7-d 验收未通过 ===');
    process.exit(1);
  }
  console.log('=== C7-d 验收通过 ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
