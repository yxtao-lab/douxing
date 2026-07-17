import { ROUTE_TEMPLATES, type RouteTemplate } from '../data/route-templates.js';
import type { LlmProviderChoice } from '../config/llm.js';
import type {
  LocaleCode,
  NodeSpanLlmUsage,
  PlanChatMessage,
  TravelIntentSnapshot,
  RagAttractionCandidate,
} from '@douxing/shared';
import {
  formatTemplateRouteDescription,
  formatTemplateRouteName,
  formatRagRouteMetaSuffix,
  normalizeRouteDayPlans,
} from '@douxing/shared';
import { canUseLlm, generateRouteFromLlm } from './llm-route-generator.service.js';
import {
  canUseAiServiceForRoute,
  generateRouteFromAiService,
} from './ai-service-route-generator.service.js';
import {
  buildIntentFromHistory,
  enforceRouteConstraints,
  finalizePlanningIntent,
  parseTravelIntent,
  resolvePlanningCity,
} from './travel-intent.service.js';
import { buildIntentFromHistoryAsync } from './llm-intent-parser.service.js';
import {
  applyRagToRouteDraft,
  buildRouteFromRagCatalog,
  retrieveAttractionsForPlanning,
} from './attraction-rag.service.js';
import { enrichRouteDraft } from './route-enricher.service.js';
import {
  retrievePlaybooksForPlanning,
  type MatchedRoutePlaybook,
} from './playbook-rag.service.js';
import { validateRouteDraft } from './validate-route.service.js';
import {
  resolvePoiHitRate,
  shouldFallbackToRagCatalog,
} from './route-quality-metrics.service.js';
import { getPoiHitRateFallbackThreshold } from '../config/vector-rag.js';

export interface GenerateRouteInput {
  prompt: string;
  days?: number;
  budget?: string;
  /** 模型提供商：auto | deepseek | lmstudio */
  provider?: LlmProviderChoice;
  /** 多轮对话历史（不含当前 prompt） */
  history?: PlanChatMessage[];
  /** C2：已解析的结构化意图（可选，未传则自动从对话抽取） */
  intent?: TravelIntentSnapshot;
  /** C3：RAG 候选景点（可选，未传则自动检索） */
  ragCandidates?: RagAttractionCandidate[];
  /** H9-4：玩法动线（可选，未传则自动检索） */
  playbookMatches?: MatchedRoutePlaybook[];
  /** C4：方案变体提示（经典/文化/休闲等） */
  variantHint?: string;
  variantKey?: string;
  /** C4：RAG 组装时轮换候选起点 */
  ragVariantIndex?: number;
  /** 输出语言（路线标题、简介等） */
  locale?: LocaleCode;
  /** Phase 4：用户 ID（注入兴趣与记忆） */
  userId?: number;
  /** 规划会话 ID（Langfuse session 归因） */
  sessionId?: number;
  /** Phase 2：排除 POI */
  excludePoiIds?: number[];
  excludePoiNames?: string[];
  boostPoiNames?: string[];
}

export interface GeneratedRouteDraft {
  name: string;
  description: string;
  budgetRange: string;
  days: number;
  interestTags: string[];
  /** P-TAG-01：场景标签 slug 列表；来自 intent.sceneTags 或文本抽取 */
  sceneTags: string[];
  routeDetail: RouteTemplate['routeDetail'];
  unlockPrice: number;
  matchedCity: string;
  isAiGenerated: boolean;
  ragMatchedCount?: number;
  ragCandidateCount?: number;
}

function detectTags(prompt: string): string[] {
  const themes = parseTravelIntent(prompt).themes;
  return themes.length > 0 ? themes : ['休闲'];
}

/**
 * 从文本中抽取场景标签 slug（P-TAG-01 优化点 3）。
 *
 * @param prompt - 用户原始输入文本
 * @returns 命中的场景标签 slug 数组（去重）；无命中返回空数组
 */
function detectSceneTags(prompt: string): string[] {
  const text = prompt.toLowerCase();
  const hits: string[] = [];
  const map: Array<[string, string[]]> = [
    ['kids', ['溜娃', '带娃', '亲子', '孩子', '小孩', 'family fun']],
    ['date', ['约会', '情侣', '浪漫', '二人世界', 'date']],
    ['water', ['玩水', '戏水', '漂流', '水上乐园', 'water']],
    ['cool', ['纳凉', '避暑', '凉爽', 'cool retreat']],
    ['flower', ['赏花', '花海', '花季', 'flower']],
    ['night', ['夜游', '夜景', '夜市', 'night tour']],
    ['summer-escape', ['避暑', '消夏', 'summer escape']],
    ['spring', ['踏青', '春游', 'spring outing']],
    ['blessing', ['祈福', '烧香', '寺庙', 'blessing']],
    ['camping', ['露营', '帐篷', '营地', 'camping']],
  ];
  for (const [slug, keywords] of map) {
    if (keywords.some((k) => text.includes(k.toLowerCase()))) {
      hits.push(slug);
    }
  }
  return [...new Set(hits)];
}

function resolveIntent(input: GenerateRouteInput): Promise<TravelIntentSnapshot> {
  if (input.intent) return Promise.resolve(finalizePlanningIntent(input.intent));
  return buildIntentFromHistoryAsync(input.history, input.prompt, {
    days: input.days,
    budget: input.budget,
  });
}

async function resolvePlaybookMatches(
  input: GenerateRouteInput,
  intent: TravelIntentSnapshot,
): Promise<MatchedRoutePlaybook[]> {
  if (input.playbookMatches) return input.playbookMatches;
  return await retrievePlaybooksForPlanning({
    city: resolvePlanningCity(intent),
    themes: intent.themes,
    prompt: input.prompt,
  });
}

async function resolveRagCandidates(
  input: GenerateRouteInput,
  intent: TravelIntentSnapshot,
): Promise<RagAttractionCandidate[]> {
  if (input.ragCandidates) return input.ragCandidates;
  return retrieveAttractionsForPlanning({
    city: resolvePlanningCity(intent),
    themes: intent.themes,
    sceneTags: intent.sceneTags,
    prompt: input.prompt,
    days: intent.days,
    excludeIds: input.excludePoiIds,
    excludeNames: input.excludePoiNames,
    boostNames: input.boostPoiNames,
  });
}

function withRagMeta<T extends GeneratedRouteDraft>(
  draft: T,
  ragMatchedCount: number,
  ragCandidateCount: number,
): T {
  return { ...draft, ragMatchedCount, ragCandidateCount };
}

async function prepareRouteDraftBeforeEnrich(
  draft: GeneratedRouteDraft,
  input: GenerateRouteInput,
  intent: TravelIntentSnapshot,
  ragCandidates: RagAttractionCandidate[],
): Promise<GeneratedRouteDraft> {
  const constrained = enforceRouteConstraints(draft, intent);
  const normalizedDays = normalizeRouteDayPlans(constrained.routeDetail.days, {
    startDate: intent.startDate,
    locale: input.locale,
  });
  const withCalendarDates = {
    ...constrained,
    routeDetail: { days: normalizedDays },
  };
  return applyRagToRouteDraft(withCalendarDates, ragCandidates);
}

async function finalizeRouteDraft(
  draft: GeneratedRouteDraft,
  input: GenerateRouteInput,
  intent: TravelIntentSnapshot,
  ragCandidates: RagAttractionCandidate[],
  playbookMatches: MatchedRoutePlaybook[],
): Promise<GeneratedRouteDraft> {
  const linked = await prepareRouteDraftBeforeEnrich(draft, input, intent, ragCandidates);
  const enriched = await enrichRouteDraft(linked, {
    intent,
    locale: input.locale,
    playbooks: playbookMatches,
  });
  const validated = validateRouteDraft(enriched, {
    locale: input.locale,
    ragCandidates,
    autoFix: true,
  });
  return withRagMeta(
    validated.draft,
    validated.draft.ragMatchedCount ?? enriched.ragMatchedCount ?? linked.ragMatchedCount ?? 0,
    enriched.ragCandidateCount ?? linked.ragCandidateCount ?? ragCandidates.length,
  );
}

function scoreTemplate(template: RouteTemplate, city: string | null, days: number, tags: string[]): number {
  let score = 0;
  if (city && template.city === city) score += 10;
  if (Math.abs(template.days - days) <= 1) score += 5;
  for (const tag of tags) {
    if (template.interestTags.includes(tag)) score += 3;
    if (template.keywords.some((k) => k.includes(tag) || tag.includes(k))) score += 2;
  }
  return score;
}

export type GenerationSource = 'llm' | 'template';

export interface GenerateRouteOptions {
  /** Agent Tool 链：仅返回 LLM/RAG 对齐后的 draft，不跑 Enricher/校验 */
  draftOnly?: boolean;
}

/** 优先 LLM（可选 DeepSeek / LM Studio），失败则回退模板 */
export async function generateRoute(
  input: GenerateRouteInput,
  options?: GenerateRouteOptions,
): Promise<
  GeneratedRouteDraft & {
    generationSource: GenerationSource;
    llmProvider?: string;
    llmUsage?: NodeSpanLlmUsage;
    intent: TravelIntentSnapshot;
  }
> {
  const intent = await resolveIntent(input);
  const ragCandidates = await resolveRagCandidates(input, intent);
  const playbookMatches = await resolvePlaybookMatches(input, intent);
  const enrichedInput = {
    ...input,
    days: intent.days ?? input.days,
    budget: intent.budget ?? input.budget,
    intent,
    ragCandidates,
    playbookMatches,
  };

  const completeDraft = async (
    draft: GeneratedRouteDraft,
    generationSource: GenerationSource,
    llmProvider?: string,
    llmUsage?: NodeSpanLlmUsage,
  ) => {
    // P-TAG-01：确保所有生成路径都带 sceneTags（LLM/RAG/模板统一兜底）
    const sceneTags =
      draft.sceneTags && draft.sceneTags.length > 0
        ? draft.sceneTags
        : intent.sceneTags && intent.sceneTags.length > 0
          ? intent.sceneTags
          : detectSceneTags(input.prompt);
    const draftWithSceneTags: GeneratedRouteDraft = { ...draft, sceneTags };
    if (options?.draftOnly) {
      const prepared = await prepareRouteDraftBeforeEnrich(
        draftWithSceneTags,
        enrichedInput,
        intent,
        ragCandidates,
      );
      return {
        ...prepared,
        generationSource,
        llmProvider,
        llmUsage,
        intent,
      };
    }
    const finalized = await finalizeRouteDraft(
      draftWithSceneTags,
      enrichedInput,
      intent,
      ragCandidates,
      playbookMatches,
    );
    return {
      ...finalized,
      generationSource,
      llmProvider,
      llmUsage,
      intent,
    };
  };

  /**
   * 对 LLM draft 先做 RAG 对齐再评估命中率，避免可修正的别名/模糊名误触发 RAG 降级。
   *
   * @param draft - LLM 原始输出
   * @param llmProvider - 实际使用的模型提供方
   * @returns 对齐后完成 enrich 的结果，或命中不足时 RAG 组装路线
   */
  const completeLlmDraftWithPoiQualityGate = async (
    draft: GeneratedRouteDraft & { llmProvider?: string; llmUsage?: NodeSpanLlmUsage },
    llmProvider?: string,
  ) => {
    const aligned = applyRagToRouteDraft(draft, ragCandidates);
    const hitRate = resolvePoiHitRate(aligned, ragCandidates);
    if (
      shouldFallbackToRagCatalog(hitRate, getPoiHitRateFallbackThreshold()) &&
      resolvePlanningCity(intent) &&
      ragCandidates.length >= (intent.days ?? 3)
    ) {
      console.warn(
        `[route-generator] POI 命中率 ${(hitRate * 100).toFixed(0)}% 低于阈值，降级 RAG 组装`,
      );
      const ragDraft = buildRouteFromRagCatalog(
        intent,
        ragCandidates,
        input.prompt,
        input.ragVariantIndex ?? 0,
        input.variantKey,
        input.locale,
      );
      if (ragDraft) {
        return completeDraft(ragDraft, 'template');
      }
    }
    return completeDraft(aligned, 'llm', llmProvider ?? draft.llmProvider, draft.llmUsage);
  };

  if (canUseAiServiceForRoute(enrichedInput)) {
    try {
      const draft = await generateRouteFromAiService(enrichedInput);
      return await completeLlmDraftWithPoiQualityGate(draft, draft.llmProvider);
    } catch (err) {
      console.warn(
        '[route-generator] Python AI 微服务失败，回退 Node LLM:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (canUseLlm()) {
    try {
      const draft = await generateRouteFromLlm(enrichedInput);
      return await completeLlmDraftWithPoiQualityGate(draft, draft.llmProvider);
    } catch (err) {
      console.warn(
        '[route-generator] LLM 生成失败，回退模板:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const templateDraft = generateRouteFromTemplate(enrichedInput, intent, ragCandidates);
  return await completeDraft(templateDraft, 'template');
}

/** 基于模板匹配（LLM 不可用时的降级方案） */
export function generateRouteFromTemplate(
  input: GenerateRouteInput,
  intent?: TravelIntentSnapshot,
  ragCandidates: RagAttractionCandidate[] = input.ragCandidates ?? [],
): GeneratedRouteDraft {
  const resolvedIntent = intent ?? buildIntentFromHistory(input.history, input.prompt, {
    days: input.days,
    budget: input.budget,
  });
  const historyUserText = (input.history ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join('；');
  const prompt = [historyUserText, input.prompt.trim()].filter(Boolean).join('；');

  const locale = input.locale ?? 'zh-CN';
  const planningCity = resolvePlanningCity(resolvedIntent);
  if (planningCity && ragCandidates.length >= (resolvedIntent.days ?? 3)) {
    const ragDraft = buildRouteFromRagCatalog(
      resolvedIntent,
      ragCandidates,
      prompt,
      input.ragVariantIndex ?? 0,
      input.variantKey,
      locale,
    );
    if (ragDraft) {
      return {
        ...ragDraft,
        description: `${ragDraft.description}${formatRagRouteMetaSuffix(locale)}`,
      };
    }
  }

  const city = planningCity ?? resolvedIntent.city;
  const days = resolvedIntent.days ?? input.days ?? 3;
  const tags = resolvedIntent.themes.length > 0 ? resolvedIntent.themes : detectTags(prompt);
  const budget = resolvedIntent.budget ?? input.budget ?? '';

  let best = ROUTE_TEMPLATES[0];
  let bestScore = -1;
  for (const template of ROUTE_TEMPLATES) {
    const score = scoreTemplate(template, city, days, tags);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  const budgetRange = budget || best.budgetRange;
  const name = city
    ? formatTemplateRouteName({
        city,
        days,
        themeTag: tags[0],
        fallbackName: best.name,
        locale,
      })
    : best.name;

  const routeDetail = {
    days: best.routeDetail.days.map((day) => ({
      date: day.date,
      title: day.title,
      attractions: day.attractions.map((spot) => ({ ...spot })),
    })),
  };

  const promptSnippet = `${prompt.slice(0, 50)}${prompt.length > 50 ? '…' : ''}`;
  return {
    name,
    description: formatTemplateRouteDescription({
      baseDesc: best.description,
      promptSnippet,
      locale,
    }),
    budgetRange,
    days,
    interestTags: [...new Set([...best.interestTags, ...tags])],
    sceneTags: detectSceneTags(prompt),
    routeDetail,
    unlockPrice: best.unlockPrice,
    matchedCity: city ?? best.city,
    isAiGenerated: true,
  };
}
