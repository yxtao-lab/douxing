/**
 * W4 · 规划 Golden Case 自动回归
 *
 * 用法：
 *   pnpm --filter @douxing/server w4:plan-golden-cases
 *   pnpm --filter @douxing/server w4:plan-golden-cases -- --with-rag
 *   pnpm --filter @douxing/server w4:plan-golden-cases -- --report reports/plan-golden.json
 *   pnpm --filter @douxing/server w4:plan-golden-cases -- --report reports/new.json --baseline reports/plan-golden-baseline.json
 */
import '../config/env.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAN_GOLDEN_CASES } from '../data/plan-golden-cases.js';
import {
  diffPlanGoldenReports,
  runPlanGoldenSuite,
  type PlanGoldenReport,
} from '../services/plan-golden.service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const args = process.argv.slice(2);

/** Golden 套件最低通过率 */
const PLAN_GOLDEN_MIN_PASS_RATE = 1;

/**
 * 读取 CLI 参数值。
 *
 * @param flag - 参数名
 * @param fallback - 默认值
 * @returns 参数值
 */
function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

/**
 * 判断是否包含 CLI 开关。
 *
 * @param flag - 开关名
 * @returns 是否包含
 */
function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

/**
 * 打印并写入报告；可选与基线 Diff。
 *
 * @param report - 当前套件报告
 * @param reportPath - 输出 JSON 路径（相对仓库根）
 * @param baselinePath - 基线 JSON 路径（相对仓库根）
 * @returns void
 */
function emitReport(report: PlanGoldenReport, reportPath: string, baselinePath: string): void {
  for (const c of report.cases) {
    if (c.mismatch?.startsWith('skipped')) {
      console.log(`[SKIP] ${c.id} · ${c.mismatch}`);
      continue;
    }
    if (c.passed) {
      console.log(`[OK] ${c.id} · ${c.category}`);
    } else {
      console.error(`[FAIL] ${c.id} · ${c.mismatch ?? '断言失败'}`);
      if (c.failedNodeId) {
        console.error(`       nodeId/tool: ${c.failedNodeId}`);
      }
      console.error(`       actual: ${JSON.stringify(c.actual)}`);
    }
  }

  const ratePct = (report.passRate * 100).toFixed(1);
  console.log(
    `\n通过率 ${report.passedCases}/${report.totalCases} = ${ratePct}%（模式 ${report.mode}）`,
  );

  if (reportPath) {
    const absReport = resolve(repoRoot, reportPath);
    mkdirSync(dirname(absReport), { recursive: true });
    writeFileSync(absReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`报告已写入 ${absReport}`);
  }

  if (baselinePath) {
    const absBaseline = resolve(repoRoot, baselinePath);
    if (!existsSync(absBaseline)) {
      console.warn(`基线不存在，跳过 Diff: ${absBaseline}`);
      return;
    }
    const baseline = JSON.parse(readFileSync(absBaseline, 'utf8')) as PlanGoldenReport;
    const diff = diffPlanGoldenReports(baseline, report);
    diff.baselinePath = absBaseline;
    console.log('\n=== Diff（相对基线）===');
    console.log(`回归 ${diff.regressions} · 修复 ${diff.fixes}`);
    for (const entry of diff.entries) {
      const arrow = entry.currentPassed ? 'FIX' : 'REG';
      console.log(`  [${arrow}] ${entry.id}: ${entry.baselinePassed} → ${entry.currentPassed}`);
      if (entry.mismatch) console.log(`        ${entry.mismatch}`);
    }
    if (diff.regressions > 0) {
      report.passed = false;
    }
  }
}

/**
 * 主入口：运行 Golden Case 套件。
 *
 * @returns Promise<void>
 */
async function main(): Promise<void> {
  const withRag = hasFlag('--with-rag');
  const reportPath = argValue('--report', '');
  const baselinePath = argValue('--baseline', '');

  if (PLAN_GOLDEN_CASES.length < 30) {
    console.error(`[plan-golden] 数据集不足 30 条（当前 ${PLAN_GOLDEN_CASES.length}）`);
    process.exit(1);
  }

  console.log(`=== W4 规划 Golden Case（${PLAN_GOLDEN_CASES.length} 条）===\n`);

  const report = await runPlanGoldenSuite(PLAN_GOLDEN_CASES, { withRag, userId: 1 });
  emitReport(report, reportPath, baselinePath);

  if (report.passRate < PLAN_GOLDEN_MIN_PASS_RATE || !report.passed) {
    process.exit(1);
  }
  console.log('\n全部 Golden Case 通过');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
