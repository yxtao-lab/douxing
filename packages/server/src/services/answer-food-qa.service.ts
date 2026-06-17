/**
 * C7-b Step 4：美食问答 — 检索 POI 并生成助手文案（不触发生成路线）
 */
import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import { buildFoodQaAssistantReply, AttractionCategory } from '@douxing/shared';
import { retrieveAttractionsForPlanning } from './attraction-rag.service.js';
import { resolvePlanningCity } from './travel-intent.service.js';

export interface AnswerFoodQaInput {
  intent: TravelIntentSnapshot;
  prompt: string;
  locale?: LocaleCode;
  userId?: number;
}

export async function answerFoodQa(input: AnswerFoodQaInput): Promise<string> {
  const locale = input.locale ?? 'zh-CN';
  const city = resolvePlanningCity(input.intent) ?? input.intent.city ?? '';
  const themes = input.intent.themes.includes('美食')
    ? input.intent.themes
    : ['美食', ...input.intent.themes];

  const candidates = await retrieveAttractionsForPlanning({
    city: city || undefined,
    themes,
    prompt: input.prompt,
    days: 1,
    limit: 8,
  });

  const foodItems = candidates
    .filter((c) => c.category === AttractionCategory.RESTAURANT || c.category === 'restaurant')
    .slice(0, 6)
    .map((c) => ({
      name: c.name,
      description: c.description ?? '',
      ticketPrice: c.ticketPrice,
    }));

  return buildFoodQaAssistantReply({
    city,
    items: foodItems,
    locale,
  });
}
