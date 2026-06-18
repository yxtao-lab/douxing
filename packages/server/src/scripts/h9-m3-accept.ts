/**
 * H9+ M3 · Step 21 一键验收：串联 Step 16～20 自动化脚本
 *
 * 用法：
 *   pnpm --filter @douxing/server h9:m3-accept
 *   pnpm --filter @douxing/server h9:m3-accept -- --skip-db   # 无 MySQL 时跳过 CRUD DB 用例
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');

const skipDb = process.argv.includes('--skip-db');

const steps: Array<{ name: string; script: string; args?: string[] }> = [
  { name: 'Step 16 Playbook 库 + RAG 命中率', script: 'playbook:cases' },
  {
    name: 'Step 17 Web Playbook CRUD',
    script: 'playbook:crud-cases',
    args: skipDb ? ['--', '--skip-db'] : undefined,
  },
  { name: 'Step 18 C2 startDate 解析', script: 'start-date:cases' },
  { name: 'Step 19 开放时长补全', script: 'open-hours:cases' },
  { name: 'Step 20 POI soft 对齐', script: 'playbook-order:cases' },
];

let failed = 0;

console.log('=== H9+ M3 规划数据质量验收（Step 16～21 自动化）===\n');
if (skipDb) {
  console.log('[INFO] --skip-db：Step 17 跳过 DB CRUD 用例\n');
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
  console.error(`M3 自动化验收失败：${failed} 项未通过`);
  process.exit(1);
}

console.log('=== M3 自动化验收全部通过 ===');
console.log('');
console.log('手测清单（Step 21 · 建议本地/ staging 确认）：');
console.log('  1. Web `/playbooks/manage`：新建/编辑/禁用 playbook · zh-CN/en-US 摘要字段');
console.log('  2. `pnpm --filter @douxing/server enricher:demo -- --playbook --offline`');
console.log('     → 西湖段间含「建议步行/观光车」· 乱序 POI 含经典动线 warning');
console.log('  3. 规划 prompt「下周三去杭州西湖」→ 第 1 天 calendarDate 与跨城班次日期一致');
console.log('  4. 故宫闭馆日（周一）排程 → day.warnings 含闭馆提示');
console.log('  5. `pnpm --filter @douxing/server db:seed` 后 playbook RAG 读 DB（非仅 seed 文件）');
