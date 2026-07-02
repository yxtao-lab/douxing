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

/**
 * 判断当前路线生成是否应优先走 Python AI 微服务。
 *
 * @param input - 路线生成入参；`provider=douxing` 时返回 `false`（专属模型仅 Node LLM 支持）
 * @returns 微服务已启用且 provider 可被 Python 侧接受时为 `true`
 */
export function canUseAiServiceForRoute(input?: GenerateRouteInput): boolean {
  if (!canUseAiService()) return false;
  if (input?.provider === 'douxing') return false;
  return true;
}
