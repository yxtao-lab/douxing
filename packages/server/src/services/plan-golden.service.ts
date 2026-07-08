/**
 * W4 · 规划 Golden Case 自动断言与 Diff 报告。
 */
import type { TravelIntentSnapshot } from '@douxing/shared';
import { buildSeedIntent } from './agent-equivalence.service.js';
import { routeAgentIntent } from './agent-intent-router.service.js';
import { runRetrieveAttractionsTool } from '../agent/tools/retrieve-attractions.tool.js';
import { runSelectWorkflowTemplateTool } from '../agent/tools/select-workflow-template.tool.js';
import { resolvePlanningCity } from './travel-intent.service.js';
import type { PlanGoldenCase } from '../data/plan-golden-cases.js';

/** 单条用例各项检查结果 */
export interface PlanGoldenCaseChecks {
  templateId?: boolean;
  routedIntent?: boolean;
  intentDays?: boolean;
  intentCity?: boolean;
  ragHitCount?: boolean;
  toolChain?: boolean;
}

/** 单条用例执行结果 */
export interface PlanGoldenCaseResult {
  id: string;
  category: PlanGoldenCase['category'];
  prompt: string;
  passed: boolean;
  checks: PlanGoldenCaseChecks;
  actual: {
    templateId?: string;
    topK?: number;
    routedIntent?: string;
    intentDays?: number | null;
    intentCity?: string | null;
    ragHitCount?: number;
    toolTrace?: string[];
  };
  /** 首个失败断言对应的 nodeId/tool，便于 W4-3 定位 */
  failedNodeId?: string;
  mismatch?: string;
}

/** Golden 套件报告 */
export interface PlanGoldenReport {
  generatedAt: string;
  mode: 'fast' | 'with-rag';
  totalCases: number;
  passedCases: number;
  passRate: number;
  passed: boolean;
  cases: PlanGoldenCaseResult[];
}

/** Diff 条目 */
export interface PlanGoldenDiffEntry {
  id: string;
  baselinePassed: boolean;
  currentPassed: boolean;
  changed: boolean;
  mismatch?: string;
}

/** 基线对比报告 */
export interface PlanGoldenDiffReport {
  generatedAt: string;
  baselinePath: string;
  totalCompared: number;
  regressions: number;
  fixes: number;
  entries: PlanGoldenDiffEntry[];
}

export interface RunPlanGoldenOptions {
  /** 是否跑 RAG / Tool 链（需 DB） */
  withRag?: boolean;
  /** 固定 userId（A/B 稳定） */
  userId?: number;
}

function normalizeCity(city: string | null | undefined): string {
  return (city ?? '').trim().replace(/市$/u, '').toLowerCase();
}

/**
 * 由 Golden Case 构造 intent 快照。
 *
 * @param goldenCase - Golden Case
 * @returns TravelIntentSnapshot
 */
export function buildGoldenCaseIntent(goldenCase: PlanGoldenCase): TravelIntentSnapshot {
  const seed = {
    id: goldenCase.id,
    prompt: goldenCase.prompt,
    city: goldenCase.city,
    days: goldenCase.days,
    budget: goldenCase.budget,
    themes: goldenCase.themes,
  };
  let intent = buildSeedIntent(seed);
  if (goldenCase.budgetMax != null) {
    intent = { ...intent, budgetMax: goldenCase.budgetMax };
  }
  if (goldenCase.budgetMin != null) {
    intent = { ...intent, budgetMin: goldenCase.budgetMin };
  }
  if (goldenCase.cities?.length) {
    intent = {
      ...intent,
      cities: goldenCase.cities,
      city: goldenCase.cities[0] ?? intent.city,
    };
  }
  return intent;
}

/**
 * 执行单条 Golden Case 断言。
 *
 * @param goldenCase - 用例定义
 * @param options - 运行选项
 * @returns 用例结果
 */
export async function runPlanGoldenCase(
  goldenCase: PlanGoldenCase,
  options: RunPlanGoldenOptions = {},
): Promise<PlanGoldenCaseResult> {
  const userId = options.userId ?? 1;
  const expect = goldenCase.expect;
  const checks: PlanGoldenCaseChecks = {};
  const actual: PlanGoldenCaseResult['actual'] = {};
  const toolTrace: string[] = [];
  let failedNodeId: string | undefined;
  let mismatch: string | undefined;

  const fail = (checkKey: keyof PlanGoldenCaseChecks, nodeId: string, msg: string) => {
    checks[checkKey] = false;
    if (!failedNodeId) {
      failedNodeId = nodeId;
      mismatch = msg;
    }
  };

  // 意图路由
  if (expect.routedIntent != null || goldenCase.category === 'intent_route') {
    const routed = routeAgentIntent(goldenCase.prompt);
    actual.routedIntent = routed.route;
    if (expect.routedIntent != null) {
      checks.routedIntent = routed.route === expect.routedIntent;
      if (!checks.routedIntent) {
        fail('routedIntent', 'route_intent', `路由 ${routed.route} ≠ ${expect.routedIntent}`);
      }
    }
  }

  // 意图解析
  if (
    expect.intentDays != null ||
    expect.intentCity != null ||
    goldenCase.category === 'intent_parse' ||
    goldenCase.category === 'template' ||
    goldenCase.category === 'workflow_chain'
  ) {
    const intent = buildGoldenCaseIntent(goldenCase);
    actual.intentDays = intent.days;
    actual.intentCity = intent.city;
    if (expect.intentDays != null) {
      checks.intentDays = intent.days === expect.intentDays;
      if (!checks.intentDays) {
        fail('intentDays', 'parse_intent', `days ${intent.days} ≠ ${expect.intentDays}`);
      }
    }
    if (expect.intentCity != null) {
      checks.intentCity = normalizeCity(intent.city) === normalizeCity(expect.intentCity);
      if (!checks.intentCity) {
        fail('intentCity', 'parse_intent', `city ${intent.city} ≠ ${expect.intentCity}`);
      }
    }
  }

  // 模板选择
  if (
    expect.templateId != null ||
    goldenCase.category === 'template' ||
    goldenCase.category === 'workflow_chain'
  ) {
    const intent = buildGoldenCaseIntent(goldenCase);
    const routedIntent = goldenCase.followUpRoutedIntent ?? 'plan_new';
    const sel = await runSelectWorkflowTemplateTool({
      userId,
      intent,
      routedIntent,
    });
    toolTrace.push('select_workflow_template');

    if (sel.ok) {
      actual.templateId = sel.data.templateId;
      actual.topK = sel.data.nodeConfig.topK;
      if (expect.templateId != null) {
        checks.templateId = sel.data.templateId === expect.templateId;
        if (!checks.templateId) {
          fail(
            'templateId',
            'select_workflow_template',
            `template ${sel.data.templateId} ≠ ${expect.templateId}`,
          );
        }
      }
    } else if (expect.templateId != null) {
      checks.templateId = false;
      fail('templateId', 'select_workflow_template', sel.error.message);
    }
  }

  // RAG + Tool 链（workflow_chain 或显式 withRag）
  const runRag =
    options.withRag &&
    (goldenCase.category === 'workflow_chain' ||
      expect.minRagHits != null ||
      expect.toolChainIncludes?.length);

  if (runRag) {
    const intent = buildGoldenCaseIntent(goldenCase);
    const topK = actual.topK ?? expect.maxRagHits ?? 12;
    const city = resolvePlanningCity(intent) ?? goldenCase.city;
    const rag = await runRetrieveAttractionsTool({
      city: city ?? undefined,
      themes: intent.themes,
      prompt: goldenCase.prompt,
      days: intent.days ?? goldenCase.days,
      limit: topK,
    });
    toolTrace.push('retrieve_attractions');

    if (rag.ok) {
      const count = rag.data.candidates.length;
      actual.ragHitCount = count;
      const maxHits = expect.maxRagHits ?? topK;
      const minHits = expect.minRagHits ?? 0;
      const withinMax = count <= maxHits;
      const withinMin = count >= minHits;
      checks.ragHitCount = withinMax && withinMin;
      if (!withinMax) {
        fail('ragHitCount', 'retrieve_attractions', `RAG ${count} > max ${maxHits}`);
      } else if (!withinMin) {
        fail('ragHitCount', 'retrieve_attractions', `RAG ${count} < min ${minHits}`);
      }
    } else {
      checks.ragHitCount = false;
      fail('ragHitCount', 'retrieve_attractions', rag.error.message);
    }

    if (expect.toolChainIncludes?.length) {
      const missing = expect.toolChainIncludes.filter((t) => !toolTrace.includes(t));
      checks.toolChain = missing.length === 0;
      if (missing.length > 0) {
        fail('toolChain', missing[0] ?? 'tool_chain', `缺少 Tool: ${missing.join(', ')}`);
      }
    }
  }

  actual.toolTrace = toolTrace.length > 0 ? toolTrace : undefined;

  const relevantChecks = Object.values(checks);
  const passed = relevantChecks.length > 0 && relevantChecks.every(Boolean);

  return {
    id: goldenCase.id,
    category: goldenCase.category,
    prompt: goldenCase.prompt,
    passed,
    checks,
    actual,
    failedNodeId,
    mismatch,
  };
}

/**
 * 批量运行 Golden Case 套件。
 *
 * @param cases - 用例列表
 * @param options - 运行选项
 * @returns 套件报告
 */
export async function runPlanGoldenSuite(
  cases: PlanGoldenCase[],
  options: RunPlanGoldenOptions = {},
): Promise<PlanGoldenReport> {
  const results: PlanGoldenCaseResult[] = [];
  for (const goldenCase of cases) {
    if (goldenCase.category === 'workflow_chain' && !options.withRag) {
      results.push({
        id: goldenCase.id,
        category: goldenCase.category,
        prompt: goldenCase.prompt,
        passed: true,
        checks: {},
        actual: {},
        mismatch: 'skipped (use --with-rag)',
      });
      continue;
    }
    results.push(await runPlanGoldenCase(goldenCase, options));
  }

  const scored = results.filter((r) => !r.mismatch?.startsWith('skipped'));
  const passedCases = scored.filter((r) => r.passed).length;
  const totalCases = scored.length;
  const passRate = totalCases > 0 ? passedCases / totalCases : 1;

  return {
    generatedAt: new Date().toISOString(),
    mode: options.withRag ? 'with-rag' : 'fast',
    totalCases,
    passedCases,
    passRate,
    passed: passedCases === totalCases,
    cases: results,
  };
}

/**
 * 对比当前报告与基线，输出回归/修复列表（W4-3）。
 *
 * @param baseline - 基线报告
 * @param current - 当前报告
 * @returns Diff 报告
 */
export function diffPlanGoldenReports(
  baseline: PlanGoldenReport,
  current: PlanGoldenReport,
): PlanGoldenDiffReport {
  const baselineMap = new Map(baseline.cases.map((c) => [c.id, c]));
  const entries: PlanGoldenDiffEntry[] = [];
  let regressions = 0;
  let fixes = 0;

  for (const cur of current.cases) {
    const base = baselineMap.get(cur.id);
    if (!base) continue;
    const changed = base.passed !== cur.passed;
    if (changed && base.passed && !cur.passed) regressions += 1;
    if (changed && !base.passed && cur.passed) fixes += 1;
    entries.push({
      id: cur.id,
      baselinePassed: base.passed,
      currentPassed: cur.passed,
      changed,
      mismatch: changed ? (cur.mismatch ?? base.mismatch) : undefined,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    baselinePath: '',
    totalCompared: entries.length,
    regressions,
    fixes,
    entries: entries.filter((e) => e.changed),
  };
}
