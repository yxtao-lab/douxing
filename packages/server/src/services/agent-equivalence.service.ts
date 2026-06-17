/**
 * Step 10：管道 vs Agent 首句规划结构化等价对比
 */
import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import {
  generateRoute,
  type GeneratedRouteDraft,
  type GenerateRouteInput,
} from './route-generator.service.js';
import { enrichRouteDraft } from './route-enricher.service.js';
import { validateRouteDraft } from './validate-route.service.js';
import { buildIntentFromHistory } from './travel-intent.service.js';

/** 路线图 Step 10 验收阈值 */
export const AGENT_EQUIVALENCE_MIN_RATE = 0.95;

export interface EquivalenceSeedCase {
  id: string;
  prompt: string;
  city?: string;
  days?: number;
  budget?: string;
  themes?: string[];
}

export interface EquivalenceCompareChecks {
  city: boolean;
  days: boolean;
  poiByDay: boolean;
  poiJaccard: number;
}

export interface EquivalenceCaseResult {
  id: string;
  prompt: string;
  equivalent: boolean;
  checks: EquivalenceCompareChecks;
  pipelineSummary: string;
  agentSummary: string;
  mismatch?: string;
}

export interface EquivalenceReport {
  generatedAt: string;
  mode: 'deterministic' | 'live' | 'draft-only-fallback';
  totalCases: number;
  equivalentCases: number;
  equivalenceRate: number;
  threshold: number;
  passed: boolean;
  cases: EquivalenceCaseResult[];
}

export interface RunEquivalenceOptions {
  locale?: LocaleCode;
  /** 不访问 LLM/ai-service，走模板链（CI 默认） */
  deterministic?: boolean;
  /** 按天 POI 集合 Jaccard 下限（默认 1 = 严格一致） */
  poiJaccardMin?: number;
  /** 无 DATABASE_URL 时仅对比 generate draft 阶段（不跑 Enricher） */
  allowDraftOnlyFallback?: boolean;
  /** 跳过 Enricher/高德调用，仅对比 generate 后结构化字段（CI 快速模式） */
  skipEnrich?: boolean;
}

function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function normalizeCity(city: string | null | undefined): string {
  return (city ?? '')
    .trim()
    .replace(/市$/u, '')
    .toLowerCase();
}

function normalizePoiName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase();
}

function collectPoiNamesByDay(draft: GeneratedRouteDraft): string[][] {
  return draft.routeDetail.days.map((day) =>
    (day.attractions ?? [])
      .map((a) => normalizePoiName(a.name))
      .filter(Boolean)
      .sort(),
  );
}

function comparePoiByDay(
  left: string[][],
  right: string[][],
  poiJaccardMin: number,
): { match: boolean; jaccard: number } {
  if (left.length !== right.length) {
    return { match: false, jaccard: 0 };
  }

  let totalUnion = 0;
  let totalIntersect = 0;
  let allDaysStrict = true;

  for (let i = 0; i < left.length; i += 1) {
    const setA = new Set(left[i]);
    const setB = new Set(right[i]!);
    const inter = [...setA].filter((x) => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    totalIntersect += inter;
    totalUnion += union;
    if (inter !== union) allDaysStrict = false;
  }

  const jaccard = totalUnion > 0 ? totalIntersect / totalUnion : 1;
  const match = allDaysStrict || jaccard >= poiJaccardMin;
  return { match, jaccard };
}

function summarizeDraft(draft: GeneratedRouteDraft): string {
  const pois = collectPoiNamesByDay(draft)
    .map((names, i) => `D${i + 1}[${names.join('、') || '-'}]`)
    .join(' ');
  return `${draft.matchedCity} · ${draft.days}天 · ${pois}`;
}

export function buildSeedIntent(seed: EquivalenceSeedCase): TravelIntentSnapshot {
  let intent = buildIntentFromHistory(undefined, seed.prompt, {
    days: seed.days,
    budget: seed.budget,
  });
  if (seed.city) {
    intent = {
      ...intent,
      city: seed.city,
      cities: [seed.city],
      suggestedDestinations: [seed.city],
    };
  }
  if (seed.themes?.length) {
    intent = { ...intent, themes: seed.themes };
  }
  if (seed.days != null) {
    intent = { ...intent, days: seed.days };
  }
  return intent;
}

function buildGenerateInput(
  seed: EquivalenceSeedCase,
  intent: TravelIntentSnapshot,
  options: RunEquivalenceOptions,
): GenerateRouteInput {
  const deterministic = options.deterministic !== false;
  const skipRag = deterministic && !isDatabaseConfigured();
  return {
    prompt: seed.prompt,
    days: seed.days,
    budget: seed.budget,
    locale: options.locale ?? 'zh-CN',
    intent,
    ragCandidates: skipRag ? [] : deterministic ? [] : undefined,
    playbookMatches: skipRag ? [] : deterministic ? [] : undefined,
  };
}

function shouldUseDraftOnlyFallback(options: RunEquivalenceOptions): boolean {
  if (options.skipEnrich) return true;
  return options.allowDraftOnlyFallback !== false && !isDatabaseConfigured();
}

/** 现网管道：generateRoute 全量 finalize */
export async function runPipelineFirstSentencePlan(
  input: GenerateRouteInput,
  options: RunEquivalenceOptions = {},
): Promise<GeneratedRouteDraft> {
  if (shouldUseDraftOnlyFallback(options)) {
    return generateRoute(input, { draftOnly: true });
  }
  const result = await generateRoute(input);
  return result;
}

/**
 * Agent 首句链（对齐 graph.py `_run_plan_new_branch`）：
 * generate_route_draft（draftOnly）→ enrich_route → validate_route
 */
export async function runAgentFirstSentencePlan(
  input: GenerateRouteInput,
  options: RunEquivalenceOptions = {},
): Promise<GeneratedRouteDraft> {
  const draftOnly = await generateRoute(input, { draftOnly: true });
  if (shouldUseDraftOnlyFallback(options)) {
    return draftOnly;
  }

  const intent = draftOnly.intent ?? input.intent;
  if (!intent) {
    throw new Error('Agent 路径缺少 intent');
  }

  const playbooks = input.playbookMatches ?? [];
  const enriched = await enrichRouteDraft(draftOnly, {
    intent,
    locale: input.locale,
    playbooks,
  });
  const validated = validateRouteDraft(enriched, {
    locale: input.locale,
    ragCandidates: input.ragCandidates ?? [],
    autoFix: true,
  });
  return validated.draft;
}

export function comparePlanDrafts(
  pipeline: GeneratedRouteDraft,
  agent: GeneratedRouteDraft,
  poiJaccardMin = 1,
): Omit<EquivalenceCaseResult, 'id' | 'prompt'> {
  const city = normalizeCity(pipeline.matchedCity) === normalizeCity(agent.matchedCity);
  const days =
    pipeline.days === agent.days &&
    pipeline.routeDetail.days.length === agent.routeDetail.days.length;

  const poiCompare = comparePoiByDay(
    collectPoiNamesByDay(pipeline),
    collectPoiNamesByDay(agent),
    poiJaccardMin,
  );

  const checks: EquivalenceCompareChecks = {
    city,
    days,
    poiByDay: poiCompare.match,
    poiJaccard: poiCompare.jaccard,
  };

  const equivalent = city && days && poiCompare.match;
  let mismatch: string | undefined;
  if (!equivalent) {
    const parts: string[] = [];
    if (!city) parts.push(`城市 ${pipeline.matchedCity} vs ${agent.matchedCity}`);
    if (!days) parts.push(`天数 ${pipeline.days} vs ${agent.days}`);
    if (!poiCompare.match) {
      parts.push(`POI Jaccard ${(poiCompare.jaccard * 100).toFixed(1)}%`);
    }
    mismatch = parts.join('；');
  }

  return {
    equivalent,
    checks,
    pipelineSummary: summarizeDraft(pipeline),
    agentSummary: summarizeDraft(agent),
    mismatch,
  };
}

export async function runEquivalenceCase(
  seed: EquivalenceSeedCase,
  options: RunEquivalenceOptions = {},
): Promise<EquivalenceCaseResult> {
  const poiJaccardMin = options.poiJaccardMin ?? 1;
  const intent = buildSeedIntent(seed);
  const input = buildGenerateInput(seed, intent, options);

  const [pipelineDraft, agentDraft] = await Promise.all([
    runPipelineFirstSentencePlan(input, options),
    runAgentFirstSentencePlan(input, options),
  ]);

  const compared = comparePlanDrafts(pipelineDraft, agentDraft, poiJaccardMin);
  return {
    id: seed.id,
    prompt: seed.prompt,
    ...compared,
  };
}

export async function runEquivalenceSuite(
  seeds: EquivalenceSeedCase[],
  options: RunEquivalenceOptions = {},
): Promise<EquivalenceReport> {
  const cases: EquivalenceCaseResult[] = [];
  for (const seed of seeds) {
    cases.push(await runEquivalenceCase(seed, options));
  }

  const equivalentCases = cases.filter((c) => c.equivalent).length;
  const equivalenceRate = seeds.length > 0 ? equivalentCases / seeds.length : 0;

  let mode: EquivalenceReport['mode'] = options.deterministic === false ? 'live' : 'deterministic';
  if (options.skipEnrich) {
    mode = 'draft-only-fallback';
  } else if (shouldUseDraftOnlyFallback({ ...options, skipEnrich: false })) {
    mode = 'draft-only-fallback';
  }

  return {
    generatedAt: new Date().toISOString(),
    mode,
    totalCases: seeds.length,
    equivalentCases,
    equivalenceRate,
    threshold: AGENT_EQUIVALENCE_MIN_RATE,
    passed: equivalenceRate >= AGENT_EQUIVALENCE_MIN_RATE,
    cases,
  };
}
