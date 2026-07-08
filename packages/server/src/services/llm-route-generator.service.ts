import type { LlmProviderChoice } from '../config/llm.js';
import type { GenerateRouteInput, GeneratedRouteDraft } from './route-generator.service.js';
import type { NodeSpanLlmUsage } from '@douxing/shared';
import { chatCompletionForRoute } from './llm-client.service.js';
import { enforceRouteConstraints } from './travel-intent.service.js';
import { isLlmEnabled, resolveProviderChain } from '../config/llm.js';

export type GenerationSource = 'llm' | 'template';
export type LlmProviderUsed = 'douxing' | 'deepseek' | 'lmstudio';

/** 使用大模型生成路线（兜行微调 / DeepSeek / LM Studio，auto 按链降级） */
export async function generateRouteFromLlm(
  input: GenerateRouteInput,
): Promise<
  GeneratedRouteDraft & { llmProvider: LlmProviderUsed; llmUsage?: NodeSpanLlmUsage }
> {
  const intent = input.intent!;
  const { payload, provider, llmUsage } = await chatCompletionForRoute(input.prompt.trim(), {
    days: intent.days ?? input.days,
    budget: intent.budget ?? input.budget,
    provider: input.provider,
    history: input.history,
    intent,
    ragCandidates: input.ragCandidates,
    playbookMatches: input.playbookMatches,
    variantHint: input.variantHint,
    locale: input.locale,
    userId: input.userId,
    sessionId: input.sessionId,
  });

  const draft: GeneratedRouteDraft = {
    name: payload.name,
    description: payload.description,
    budgetRange: payload.budgetRange,
    days: payload.days,
    interestTags: payload.interestTags,
    routeDetail: {
      days: payload.routeDetail.days.map((day) => ({
        date: day.date,
        title: day.title,
        attractions: day.attractions.map((spot) => ({ ...spot })),
      })),
    },
    unlockPrice: payload.unlockPrice,
    matchedCity: payload.matchedCity,
    isAiGenerated: true,
  };

  return {
    ...enforceRouteConstraints(draft, intent),
    llmProvider: provider,
    llmUsage,
  };
}

export function canUseLlm(): boolean {
  if (!isLlmEnabled()) return false;
  return resolveProviderChain('auto').length > 0;
}
