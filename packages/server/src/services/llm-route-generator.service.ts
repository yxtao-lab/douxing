import type { LlmProviderChoice } from '../config/llm.js';
import type { GenerateRouteInput, GeneratedRouteDraft } from './route-generator.service.js';
import { chatCompletionForRoute } from './llm-client.service.js';
import { enforceRouteConstraints } from './travel-intent.service.js';
import { isLlmEnabled, hasDeepseekApiKey, resolveProviderChain } from '../config/llm.js';

export type GenerationSource = 'llm' | 'template';
export type LlmProviderUsed = 'deepseek' | 'lmstudio';

/** 使用大模型生成路线（支持 DeepSeek / LM Studio） */
export async function generateRouteFromLlm(
  input: GenerateRouteInput,
): Promise<GeneratedRouteDraft & { llmProvider: LlmProviderUsed }> {
  const intent = input.intent!;
  const { payload, provider } = await chatCompletionForRoute(input.prompt.trim(), {
    days: intent.days ?? input.days,
    budget: intent.budget ?? input.budget,
    provider: input.provider,
    history: input.history,
    intent,
    ragCandidates: input.ragCandidates,
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
  };
}

export function canUseLlm(): boolean {
  if (!isLlmEnabled()) return false;
  return resolveProviderChain('auto').length > 0 || hasDeepseekApiKey();
}
