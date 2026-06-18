/**
 * H9+-1 · Step 16 Playbook 库扩充验收
 *
 * 用法：
 *   pnpm --filter @douxing/server playbook:cases
 *   pnpm --filter @douxing/server playbook:cases -- --report reports/playbook-rag.json
 */
import '../config/env.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PLAYBOOK_ALIAS_MIN_COVERAGE,
  PLAYBOOK_RETRIEVAL_CASES,
  PLAYBOOK_RETRIEVAL_MIN_HIT_RATE,
  PLAYBOOK_TOP_10_CITIES,
} from '../data/playbook-top-cities.js';
import { ROUTE_PLAYBOOKS } from '../data/route-playbooks.js';
import {
  computeAllPlaybookAliasCoverage,
  countPlaybooksByCity,
} from '../services/playbook-alias.service.js';
import { retrievePlaybooksFromCatalog } from '../services/playbook-rag.service.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../../..');
const args = process.argv.slice(2);

function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
}

const reportPath = argValue('--report', '');

interface RetrievalCaseResult {
  id: string;
  city: string;
  expectPlaybookId: string;
  hit: boolean;
  topMatches: Array<{ id: string; score: number }>;
}

function runRetrievalCases(): {
  hitRate: number;
  results: RetrievalCaseResult[];
} {
  const results: RetrievalCaseResult[] = [];

  for (const testCase of PLAYBOOK_RETRIEVAL_CASES) {
    const matches = retrievePlaybooksFromCatalog(ROUTE_PLAYBOOKS, {
      city: testCase.city,
      themes: testCase.themes,
      prompt: testCase.prompt,
      limit: 3,
    });

    const topMatches = matches.map((item) => ({
      id: item.playbook.id,
      score: item.score,
    }));
    const hit = topMatches.some((item) => item.id === testCase.expectPlaybookId);

    results.push({
      id: testCase.id,
      city: testCase.city,
      expectPlaybookId: testCase.expectPlaybookId,
      hit,
      topMatches,
    });

    const status = hit ? 'OK' : 'FAIL';
    const topIds = topMatches.map((item) => `${item.id}(${item.score})`).join(', ') || '(none)';
    console.log(`[${status}] ${testCase.id} | expect=${testCase.expectPlaybookId} | top=${topIds}`);
  }

  const hits = results.filter((item) => item.hit).length;
  const hitRate = results.length === 0 ? 1 : hits / results.length;
  return { hitRate, results };
}

function checkTop10CityCoverage(): { ok: boolean; missing: string[]; counts: Record<string, number> } {
  const countsMap = countPlaybooksByCity(ROUTE_PLAYBOOKS);
  const counts: Record<string, number> = {};
  const missing: string[] = [];

  for (const city of PLAYBOOK_TOP_10_CITIES) {
    const count = countsMap.get(city) ?? 0;
    counts[city] = count;
    if (count < 1) missing.push(city);
    console.log(`[${count >= 1 ? 'OK' : 'FAIL'}] ${city}: ${count} playbook(s)`);
  }

  return { ok: missing.length === 0, missing, counts };
}

async function main(): Promise<void> {
  console.log('=== H9+-1 Playbook 库扩充验收（Step 16）===\n');

  console.log('--- TOP 10 城市覆盖 ---');
  const cityCoverage = checkTop10CityCoverage();
  console.log('');

  console.log('--- C3 alias 对齐率 ---');
  const aliasReport = computeAllPlaybookAliasCoverage();
  for (const item of aliasReport.perPlaybook) {
    const pct = (item.coverage * 100).toFixed(0);
    const status = item.coverage >= PLAYBOOK_ALIAS_MIN_COVERAGE ? 'OK' : 'WARN';
    console.log(
      `[${status}] ${item.playbookId}: ${pct}% (${item.resolvedTokens}/${item.totalTokens})` +
        (item.unresolved.length > 0 ? ` | 未对齐: ${item.unresolved.join('、')}` : ''),
    );
  }
  console.log(
    `整体 alias 覆盖率: ${(aliasReport.overallCoverage * 100).toFixed(1)}% (阈值 ≥${(PLAYBOOK_ALIAS_MIN_COVERAGE * 100).toFixed(0)}%)`,
  );
  console.log('');

  console.log('--- RAG 检索命中率 ---');
  const retrieval = runRetrievalCases();
  console.log(
    `\n检索命中率: ${(retrieval.hitRate * 100).toFixed(1)}% (${retrieval.results.filter((r) => r.hit).length}/${retrieval.results.length})` +
      ` · 阈值 ≥${(PLAYBOOK_RETRIEVAL_MIN_HIT_RATE * 100).toFixed(0)}%`,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    seedCount: ROUTE_PLAYBOOKS.length,
    top10CityCoverage: cityCoverage,
    aliasCoverage: {
      overall: aliasReport.overallCoverage,
      minRequired: PLAYBOOK_ALIAS_MIN_COVERAGE,
      perPlaybook: aliasReport.perPlaybook,
    },
    retrieval: {
      hitRate: retrieval.hitRate,
      minRequired: PLAYBOOK_RETRIEVAL_MIN_HIT_RATE,
      cases: retrieval.results,
    },
  };

  if (reportPath) {
    const abs = resolve(repoRoot, reportPath);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n报告已写入: ${abs}`);
  }

  let failed = 0;
  if (!cityCoverage.ok) {
    failed += 1;
    console.error(`\n[FAIL] TOP 10 缺 playbook 城市: ${cityCoverage.missing.join('、')}`);
  }
  if (aliasReport.overallCoverage < PLAYBOOK_ALIAS_MIN_COVERAGE) {
    failed += 1;
    console.error(
      `\n[FAIL] alias 覆盖率 ${(aliasReport.overallCoverage * 100).toFixed(1)}% 低于阈值`,
    );
  }
  if (retrieval.hitRate < PLAYBOOK_RETRIEVAL_MIN_HIT_RATE) {
    failed += 1;
    console.error(`\n[FAIL] 检索命中率 ${(retrieval.hitRate * 100).toFixed(1)}% 低于阈值`);
  }

  if (failed > 0) {
    console.error(`\nStep 16 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('\n=== Step 16 验收全部通过 ===');
}

main().catch((err) => {
  console.error('[playbook-cases] 运行失败:', err);
  process.exit(1);
});
