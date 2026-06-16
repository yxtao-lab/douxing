import type { LocaleCode, RagAttractionCandidate } from '@douxing/shared';
import type { GeneratedRouteDraft } from '../../services/route-generator.service.js';
import { validateRouteDraft } from '../../services/validate-route.service.js';
import { validateRouteInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runValidateRouteTool(raw: unknown) {
  const parsed = validateRouteInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const result = validateRouteDraft(parsed.data.draft as unknown as GeneratedRouteDraft, {
    locale: parsed.data.locale as LocaleCode | undefined,
    ragCandidates: parsed.data.ragCandidates as RagAttractionCandidate[] | undefined,
    autoFix: parsed.data.autoFix,
  });

  return toolSuccess(result);
}
