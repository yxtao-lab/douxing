import type { LocaleCode, TravelIntentSnapshot } from '@douxing/shared';
import { answerFoodQa } from '../../services/answer-food-qa.service.js';
import { answerFoodQaInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runAnswerFoodQaTool(raw: unknown) {
  const parsed = answerFoodQaInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const assistantMessage = await answerFoodQa({
    intent: parsed.data.intent as unknown as TravelIntentSnapshot,
    prompt: parsed.data.prompt,
    locale: parsed.data.locale as LocaleCode | undefined,
    userId: parsed.data.userId,
  });

  return toolSuccess({ assistantMessage });
}
