/**
 * M5 · Step 31～34 行中智能一键验收
 *
 * 用法：
 *   pnpm --filter @douxing/server h5:m5-accept
 *   pnpm --filter @douxing/server h5:m5-accept -- --skip-db
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');

const skipDb = process.argv.includes('--skip-db');
const dbArgs = skipDb ? ['--', '--skip-db'] : undefined;
const offlineDbArgs = skipDb ? ['--', '--offline', '--skip-db'] : ['--', '--offline'];

const steps: Array<{ name: string; script: string; args?: string[] }> = [
  { name: 'Step 31 H8 replan_segment', script: 'replan-segment:cases', args: offlineDbArgs },
  { name: 'Step 32 H8 transit_agent + UI', script: 'h8:transit-agent-cases', args: dbArgs },
  { name: 'Step 33 H7 错过景点补救', script: 'h7:missed-poi-cases', args: dbArgs },
  { name: 'Step 34 H3-d 行中宠物', script: 'h3-d:in-trip-cases', args: dbArgs },
];

let failed = 0;

console.log('=== M5 行中智能验收（Step 31～34 自动化）===\n');
if (skipDb) {
  console.log('[INFO] --skip-db：跳过依赖 MySQL 的 DB 用例\n');
}

for (const step of steps) {
  console.log(`--- ${step.name} ---`);
  const result = spawnSync('pnpm', [step.script, ...(step.args ?? [])], {
    cwd: serverRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`\n[FAIL] ${step.name}\n`);
  } else {
    console.log(`\n[PASS] ${step.name}\n`);
  }
}

if (failed > 0) {
  console.error(`M5 自动化验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('=== M5 自动化验收全部通过 ===');
console.log('');
console.log('手测清单（Step 34 · 建议本地确认）：');
console.log('  1. 路线详情打卡 → 弹出宠物庆祝（EXP / 升级文案）· zh-CN/en-US');
console.log('  2. 路线详情「行中分析」→ insight + 宠物回复');
console.log('  3. 「查看遗漏景点」「刷新剩余行程」与 H7/H8 联动正常');
console.log('  4. 悬浮层 Lv 随打卡增长');
