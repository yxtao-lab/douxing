import type { GenerateRouteInput, GeneratedRouteDraft } from './route-generator.service.js';
import { chatCompletionForRoute } from './llm-client.service.js';
import { isLlmEnabled } from '../config/llm.js';

export type GenerationSource = 'llm' | 'template';

/** 使用 LM Studio 大模型生成路线 */
export async function generateRouteFromLlm(
  input: GenerateRouteInput,
): Promise<GeneratedRouteDraft> {
  const payload = await chatCompletionForRoute(input.prompt.trim(), {
    days: input.days,
    budget: input.budget,
  });

  return {
    name: payload.name,
    description: payload.description,
    budgetRange: payload.budgetRange,
    days: payload.days,
    interestTags: payload.interestTags,
    routeDetail: payload.routeDetail,
    unlockPrice: payload.unlockPrice,
    matchedCity: payload.matchedCity,
    isAiGenerated: true,
  };
}

export function canUseLlm(): boolean {
  return isLlmEnabled();
}
