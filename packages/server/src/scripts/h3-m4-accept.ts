/**
 * H3 + C7-c · M4 Step 25～30 一键验收
 *
 * 用法：
 *   pnpm --filter @douxing/server h3:m4-accept
 *   pnpm --filter @douxing/server h3:m4-accept -- --skip-db
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');

const skipDb = process.argv.includes('--skip-db');
const dbArgs = skipDb ? ['--', '--skip-db'] : undefined;

const steps: Array<{ name: string; script: string; args?: string[] }> = [
  { name: 'Step 25 H3-a 领养 API', script: 'pet:adopt-cases', args: dbArgs },
  { name: 'Step 26 C7-c memory_agent', script: 'memory-agent:cases', args: dbArgs },
  { name: 'Step 27 规划页 Focus UI', script: 'plan-pet-focus:cases' },
  { name: 'Step 28 H3-b 全站悬浮层', script: 'travel-pet-floating:cases', args: dbArgs },
  { name: 'Step 29 H3-c 记忆墙 / analyze', script: 'pet:memory-analyze-cases', args: dbArgs },
  { name: 'Step 30 第二轮规划体现遗憾', script: 'h3:regret-second-plan-cases', args: dbArgs },
];

let failed = 0;

console.log('=== H3 + C7-c M4 记忆与宠物验收（Step 25～30 自动化）===\n');
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
  console.error(`M4 自动化验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('=== M4 自动化验收全部通过 ===');
console.log('');
console.log('手测清单（Step 30 · 建议本地确认）：');
console.log('  1. 登录 → 我的 → 记忆墙：写入/删除/置顶记忆 · zh-CN/en-US 文案');
console.log('  2. 记忆墙「规划前分析」→ 确认写入建议记忆 → 列表可见');
console.log('  3. 悬浮层：气泡可读 analyze 缓存 · 入口进记忆墙 / 分析');
console.log('  4. 规划页：Focus 卡片展示「我记得的事」含 regret 条目（需先有遗憾记忆）');
console.log('  5. 第二轮规划（成都 + 已有火锅遗憾记忆）→ 助手回复带宠物口吻 · RAG 优先补偿 POI');
console.log('  6. AGENT_PLAN_ENABLED=true 时 SSE 可见 memory_agent / apply_memory_context');
console.log('  7. zh-CN / en-US 切换：宠物文案、记忆墙、分析卡片无硬编码');
