/**
 * C7 M2 · Step 15 一键验收：串联 Step 1～14 自动化脚本
 *
 * 用法：
 *   pnpm --filter @douxing/server agent:m2-accept
 *   pnpm --filter @douxing/server agent:m2-accept -- --skip-equivalence  # 跳过等价率（无 DB 时）
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');

const skipEquivalence = process.argv.includes('--skip-equivalence');

const steps: Array<{ name: string; script: string; args?: string[] }> = [
  { name: 'Step 1 意图路由', script: 'agent:intent-cases' },
  { name: 'Step 4 四类分支', script: 'agent:branch-cases' },
  { name: 'Step 5 局部修改 E2E', script: 'agent:e2e-cases' },
  { name: 'Step 12～14 M2 本地', script: 'agent:m2-cases' },
];

if (!skipEquivalence) {
  steps.push({
    name: 'Step 10 等价率（--fast）',
    script: 'agent:equivalence-cases',
    args: ['--', '--fast'],
  });
}

let failed = 0;

console.log('=== C7 M2 Agent 核心验收（自动化）===\n');

for (const step of steps) {
  console.log(`--- ${step.name} ---`);
  const result = spawnSync('pnpm', [step.script, ...(step.args ?? [])], {
    cwd: serverRoot,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      LLM_ENABLED: 'false',
      AI_SERVICE_ENABLED: 'false',
    },
  });
  if (result.status !== 0) {
    failed += 1;
    console.error(`\n[FAIL] ${step.name}\n`);
  } else {
    console.log(`\n[PASS] ${step.name}\n`);
  }
}

if (failed > 0) {
  console.error(`M2 自动化验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('=== M2 自动化验收全部通过 ===');
console.log('');
console.log('staging 手测清单（Step 15 · 部署后人工确认）：');
console.log('  1. staging .env：AGENT_PLAN_ENABLED=true · AI_SERVICE_ENABLED=true');
console.log('  2. 首句规划 → 2～3 套候选 + assistant 含「行程提示」warnings（如有）');
console.log('  3. 追问「第三天轻松点」→ day1～2 不变 · SSE 展示 Tool 进度');
console.log('  4. 追问「成都有什么好吃的」→ 仅美食文案 · 路线不变');
console.log('  5. 停 ai-service → 首句/追问仍成功（管道降级 · generationPath=pipeline）');
console.log('  6. zh-CN / en-US 切换 · agent.status.* 文案正确');
