import type { LocaleCode, RagAttractionCandidate, TravelIntentSnapshot } from '@douxing/shared';
import { generateRoute } from '../../services/route-generator.service.js';
import {
  loadPlanUserContext,
  mergeIntentWithUserContext,
} from '../../services/plan-user-context.service.js';
import { generateRouteDraftInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runGenerateRouteDraftTool(raw: unknown) {
  const parsed = generateRouteDraftInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const input = parsed.data;
  let intent = input.intent as TravelIntentSnapshot | undefined;
  let excludePoiNames: string[] | undefined;
  let boostPoiNames: string[] | undefined;

  if (input.userId) {
    const context = await loadPlanUserContext(input.userId);
    if (intent) {
      intent = mergeIntentWithUserContext(intent, context);
    }
    excludePoiNames = context.excludePoiNames;
    boostPoiNames = context.boostPoiNames;
  }

  const result = await generateRoute(
    {
      prompt: input.prompt,
      days: input.days,
      budget: input.budget,
      provider: input.provider as 'auto' | 'douxing' | 'deepseek' | 'lmstudio' | undefined,
      locale: input.locale as LocaleCode | undefined,
      intent,
      ragCandidates: input.ragCandidates as RagAttractionCandidate[] | undefined,
      variantHint: input.variantHint,
      variantKey: input.variantKey,
      ragVariantIndex: input.ragVariantIndex,
      userId: input.userId,
      excludePoiNames,
      boostPoiNames,
    },
    { draftOnly: true },
  );

  return toolSuccess({
    draft: result,
    generationSource: result.generationSource,
    intent: result.intent,
  });
}
