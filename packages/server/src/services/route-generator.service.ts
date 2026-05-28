import { ROUTE_TEMPLATES, type RouteTemplate } from '../data/route-templates.js';
import type { LlmProviderChoice } from '../config/llm.js';
import type {
  LocaleCode,
  PlanChatMessage,
  TravelIntentSnapshot,
  RagAttractionCandidate,
} from '@douxing/shared';
import {
  formatTemplateRouteDescription,
  formatTemplateRouteName,
  formatRagRouteMetaSuffix,
} from '@douxing/shared';
import { canUseLlm, generateRouteFromLlm } from './llm-route-generator.service.js';
import {
  canUseAiServiceForRoute,
  generateRouteFromAiService,
} from './ai-service-route-generator.service.js';
import {
  buildIntentFromHistory,
  enforceRouteConstraints,
  parseTravelIntent,
} from './travel-intent.service.js';
import {
  applyRagToRouteDraft,
  buildRouteFromRagCatalog,
  retrieveAttractionsForPlanning,
} from './attraction-rag.service.js';
import { enrichRouteDraft } from './route-enricher.service.js';

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
  /** C4：方案变体提示（经典/文化/休闲等） */
  variantHint?: string;
  variantKey?: string;
  /** C4：RAG 组装时轮换候选起点 */
  ragVariantIndex?: number;
  /** 输出语言（路线标题、简介等） */
  locale?: LocaleCode;
}

export interface GeneratedRouteDraft {
  name: string;
  description: string;
  budgetRange: string;
  days: number;
  interestTags: string[];
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

function resolveIntent(input: GenerateRouteInput): TravelIntentSnapshot {
  if (input.intent) return input.intent;
  return buildIntentFromHistory(input.history, input.prompt, {
    days: input.days,
    budget: input.budget,
  });
}

async function resolveRagCandidates(
  input: GenerateRouteInput,
  intent: TravelIntentSnapshot,
): Promise<RagAttractionCandidate[]> {
  if (input.ragCandidates) return input.ragCandidates;
  return retrieveAttractionsForPlanning({
    city: intent.city,
    themes: intent.themes,
    prompt: input.prompt,
    days: intent.days,
  });
}

function withRagMeta<T extends GeneratedRouteDraft>(
  draft: T,
  ragMatchedCount: number,
  ragCandidateCount: number,
): T {
  return { ...draft, ragMatchedCount, ragCandidateCount };
}

async function finalizeRouteDraft(
  draft: GeneratedRouteDraft,
  input: GenerateRouteInput,
  intent: TravelIntentSnapshot,
  ragCandidates: RagAttractionCandidate[],
): Promise<GeneratedRouteDraft> {
  const constrained = enforceRouteConstraints(draft, intent);
  const linked = applyRagToRouteDraft(constrained, ragCandidates);
  const enriched = await enrichRouteDraft(linked, {
    intent,
    locale: input.locale,
  });
  return withRagMeta(enriched, enriched.ragMatchedCount ?? linked.ragMatchedCount ?? 0, enriched.ragCandidateCount ?? linked.ragCandidateCount ?? ragCandidates.length);
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

/** 优先 LLM（可选 DeepSeek / LM Studio），失败则回退模板 */
export async function generateRoute(
  input: GenerateRouteInput,
): Promise<
  GeneratedRouteDraft & { generationSource: GenerationSource; llmProvider?: string; intent: TravelIntentSnapshot }
> {
  const intent = resolveIntent(input);
  const ragCandidates = await resolveRagCandidates(input, intent);
  const enrichedInput = {
    ...input,
    days: intent.days ?? input.days,
    budget: intent.budget ?? input.budget,
    intent,
    ragCandidates,
  };

  if (canUseAiServiceForRoute()) {
    try {
      const draft = await generateRouteFromAiService(enrichedInput);
      const finalized = await finalizeRouteDraft(draft, enrichedInput, intent, ragCandidates);
      return {
        ...finalized,
        generationSource: 'llm',
        llmProvider: draft.llmProvider,
        intent,
      };
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
      const finalized = await finalizeRouteDraft(draft, enrichedInput, intent, ragCandidates);
      return {
        ...finalized,
        generationSource: 'llm',
        llmProvider: draft.llmProvider,
        intent,
      };
    } catch (err) {
      console.warn(
        '[route-generator] LLM 生成失败，回退模板:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const templateDraft = generateRouteFromTemplate(enrichedInput, intent, ragCandidates);
  const finalized = await finalizeRouteDraft(templateDraft, enrichedInput, intent, ragCandidates);
  return {
    ...finalized,
    generationSource: 'template',
    intent,
  };
}

/** 基于模板匹配（LLM 不可用时的降级方案） */
export function generateRouteFromTemplate(
  input: GenerateRouteInput,
  intent?: TravelIntentSnapshot,
  ragCandidates: RagAttractionCandidate[] = input.ragCandidates ?? [],
): GeneratedRouteDraft {
  const resolvedIntent = intent ?? resolveIntent(input);
  const historyUserText = (input.history ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join('；');
  const prompt = [historyUserText, input.prompt.trim()].filter(Boolean).join('；');

  const locale = input.locale ?? 'zh-CN';
  if (resolvedIntent.city && ragCandidates.length >= (resolvedIntent.days ?? 3)) {
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

  const city = resolvedIntent.city;
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
    routeDetail,
    unlockPrice: best.unlockPrice,
    matchedCity: city ?? best.city,
    isAiGenerated: true,
  };
}
