import type { GenerateRouteInput, GeneratedRouteDraft } from './route-generator.service.js';
import { generateRouteViaAiService } from './ai-service-client.service.js';
import { enforceRouteConstraints } from './travel-intent.service.js';
import { canUseAiService } from '../config/ai-service.js';

export type AiServiceLlmProvider = 'deepseek' | 'lmstudio';

/** 通过 Python AI 微服务（LangChain）生成路线 */
export async function generateRouteFromAiService(
  input: GenerateRouteInput,
): Promise<GeneratedRouteDraft & { llmProvider: 'ai-service'; upstreamProvider: AiServiceLlmProvider }> {
  const intent = input.intent!;
  const { payload, provider } = await generateRouteViaAiService(input);

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
    llmProvider: 'ai-service',
    upstreamProvider: provider,
  };
}

export function canUseAiServiceForRoute(): boolean {
  return canUseAiService();
}
