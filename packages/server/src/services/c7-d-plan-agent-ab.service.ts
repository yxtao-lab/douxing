/**
 * C7-d · Step 37 plan_agent 专属模型 A/B 评估（基线 vs douxing）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { llmRouteSchema } from './llm-client.service.js';
import { generateRoute } from './route-generator.service.js';
import { draftToLlmTrainingPayload } from './training-data.service.js';
import { isDouxingLlmEnabled, hasDeepseekApiKey } from '../config/llm.js';

/** A/B 种子用例 */
export interface PlanAgentAbSeed {
  id: string;
  prompt: string;
  days?: number;
  city?: string;
}

/** 单次生成评估结果 */
export interface PlanAgentAbCaseResult {
  id: string;
  prompt: string;
  provider: string;
  ok: boolean;
  schemaValid: boolean;
  poiHitRate: number;
  latencyMs: number;
  llmProvider?: string;
  generationSource: string;
  routeName?: string;
  error?: string;
}

/** A/B 单侧汇总 */
export interface PlanAgentAbArmSummary {
  provider: string;
  cases: PlanAgentAbCaseResult[];
  schemaPassRate: number;
  avgPoiHitRate: number;
  avgLatencyMs: number;
}

/** 完整 A/B 报告 */
export interface PlanAgentAbReport {
  mode: 'offline' | 'live';
  baseline: PlanAgentAbArmSummary;
  challenger: PlanAgentAbArmSummary;
  pass: boolean;
  notes: string[];
}

const DEFAULT_SEEDS: PlanAgentAbSeed[] = [
  { id: 'hz-3d', prompt: '杭州3天文化之旅，预算3000左右，想逛西湖和灵隐寺', days: 3, city: '杭州' },
  { id: 'bj-5d', prompt: '北京5天亲子游，故宫、长城、环球影城，预算8000', days: 5, city: '北京' },
  { id: 'cd-2d', prompt: '成都2天美食休闲，宽窄巷子火锅', days: 2, city: '成都' },
  { id: 'sh-3d', prompt: '上海3天城市漫步，外滩陆家嘴，主题摄影', days: 3, city: '上海' },
  { id: 'xa-4d', prompt: '西安4天历史探秘，兵马俑回民街', days: 4, city: '西安' },
];

/**
 * 校验 plan_agent 图是否将 provider 传入 generate_route_draft。
 *
 * @param graphPath - graph.py 绝对路径
 * @returns 关键 wiring 是否齐全
 */
export function verifyPlanAgentProviderWiring(graphPath: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!existsSync(graphPath)) {
    return { ok: false, errors: [`graph.py 不存在: ${graphPath}`] };
  }
  const source = readFileSync(graphPath, 'utf8');
  if (!source.includes('_build_generate_route_draft_payload')) {
    errors.push('缺少 _build_generate_route_draft_payload');
  }
  if (!source.includes('"provider"') && !source.includes("'provider'")) {
    errors.push('generate_route_draft payload 未包含 provider 字段');
  }
  if (!source.includes('state.get("provider")')) {
    errors.push('未从 state 读取 provider');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * 评估单条路线 draft 的 Schema 与 POI 命中率。
 *
 * @param draft - 生成结果
 * @returns schema 是否合法与 POI 命中率
 */
function evaluateDraftSchemaAndPoi(
  draft: Awaited<ReturnType<typeof generateRoute>>,
): { schemaValid: boolean; poiHitRate: number } {
  try {
    const payload = draftToLlmTrainingPayload(draft);
    llmRouteSchema.parse(payload);
    const poiHitRate =
      draft.ragCandidateCount && draft.ragCandidateCount > 0
        ? (draft.ragMatchedCount ?? 0) / draft.ragCandidateCount
        : 1;
    return { schemaValid: true, poiHitRate };
  } catch {
    return { schemaValid: false, poiHitRate: 0 };
  }
}

/**
 * 对单条种子执行一次 generateRoute（plan_agent generate_route_draft 同源）。
 *
 * @param seed - 测试种子
 * @param provider - LLM 提供方
 * @returns 单次评估结果
 */
export async function runPlanAgentAbCase(
  seed: PlanAgentAbSeed,
  provider: 'deepseek' | 'douxing' | 'auto',
): Promise<PlanAgentAbCaseResult> {
  const started = Date.now();
  try {
    const draft = await generateRoute(
      {
        prompt: seed.prompt,
        days: seed.days,
        provider,
        locale: 'zh-CN',
      },
      { draftOnly: true },
    );
    const { schemaValid, poiHitRate } = evaluateDraftSchemaAndPoi(draft);
    return {
      id: seed.id,
      prompt: seed.prompt,
      provider,
      ok: schemaValid,
      schemaValid,
      poiHitRate,
      latencyMs: Date.now() - started,
      llmProvider: draft.llmProvider,
      generationSource: draft.generationSource,
      routeName: draft.name,
    };
  } catch (err) {
    return {
      id: seed.id,
      prompt: seed.prompt,
      provider,
      ok: false,
      schemaValid: false,
      poiHitRate: 0,
      latencyMs: Date.now() - started,
      generationSource: 'template',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 汇总单侧 A/B 指标。
 *
 * @param provider - 提供方标识
 * @param cases - 用例结果列表
 * @returns 汇总统计
 */
function summarizeArm(provider: string, cases: PlanAgentAbCaseResult[]): PlanAgentAbArmSummary {
  const n = cases.length || 1;
  const schemaPassRate = cases.filter((c) => c.schemaValid).length / n;
  const avgPoiHitRate = cases.reduce((sum, c) => sum + c.poiHitRate, 0) / n;
  const avgLatencyMs = cases.reduce((sum, c) => sum + c.latencyMs, 0) / n;
  return { provider, cases, schemaPassRate, avgPoiHitRate, avgLatencyMs };
}

/**
 * 运行 plan_agent LoRA A/B 对比（基线 deepseek vs 挑战者 douxing/auto）。
 *
 * @param seeds - 测试种子；默认内置 5 条
 * @param options - live 模式与 POI 容忍度
 * @returns A/B 报告与是否通过
 */
export async function runPlanAgentAbSuite(
  seeds: PlanAgentAbSeed[] = DEFAULT_SEEDS,
  options: {
    live?: boolean;
    baselineProvider?: 'deepseek';
    challengerProvider?: 'douxing' | 'auto';
    poiHitTolerance?: number;
    graphPath?: string;
  } = {},
): Promise<PlanAgentAbReport> {
  const live = options.live ?? false;
  const baselineProvider = options.baselineProvider ?? 'deepseek';
  const challengerProvider = options.challengerProvider ?? 'douxing';
  const poiHitTolerance = options.poiHitTolerance ?? 0.05;
  const notes: string[] = [];

  const wiring = verifyPlanAgentProviderWiring(
    options.graphPath ?? resolve(process.cwd(), '../ai-service/app/agent/graph.py'),
  );
  if (!wiring.ok) {
    notes.push(...wiring.errors.map((e) => `wiring: ${e}`));
  } else {
    notes.push('plan_agent graph provider wiring OK');
  }

  if (!live) {
    const emptyArm = summarizeArm(baselineProvider, []);
    return {
      mode: 'offline',
      baseline: { ...emptyArm, provider: baselineProvider },
      challenger: { ...emptyArm, provider: challengerProvider },
      pass: wiring.ok,
      notes: [...notes, '离线模式：加 --live 执行 deepseek vs douxing 实测'],
    };
  }

  if (!hasDeepseekApiKey()) {
    notes.push('未配置 DEEPSEEK_API_KEY，基线 arm 可能降级为模板');
  }
  if (!isDouxingLlmEnabled()) {
    notes.push('DOUXING_LLM 未启用，挑战者 arm 将无法对比');
  }

  const baselineCases: PlanAgentAbCaseResult[] = [];
  const challengerCases: PlanAgentAbCaseResult[] = [];

  for (const seed of seeds) {
    baselineCases.push(await runPlanAgentAbCase(seed, baselineProvider));
    challengerCases.push(await runPlanAgentAbCase(seed, challengerProvider));
  }

  const baseline = summarizeArm(baselineProvider, baselineCases);
  const challenger = summarizeArm(challengerProvider, challengerCases);

  const schemaOk = challenger.schemaPassRate >= baseline.schemaPassRate - 0.01;
  const poiOk = challenger.avgPoiHitRate >= baseline.avgPoiHitRate - poiHitTolerance;
  const pass = wiring.ok && schemaOk && poiOk;

  if (!schemaOk) {
    notes.push(
      `Schema 通过率未达基线：challenger ${(challenger.schemaPassRate * 100).toFixed(0)}% < baseline ${(baseline.schemaPassRate * 100).toFixed(0)}%`,
    );
  }
  if (!poiOk) {
    notes.push(
      `POI 命中率下降超 ${poiHitTolerance * 100}%：challenger ${(challenger.avgPoiHitRate * 100).toFixed(0)}% vs baseline ${(baseline.avgPoiHitRate * 100).toFixed(0)}%`,
    );
  }
  if (pass) {
    notes.push('A/B 达标：JSON 合法率与 POI 命中率不低于基线');
  }

  return { mode: 'live', baseline, challenger, pass, notes };
}
