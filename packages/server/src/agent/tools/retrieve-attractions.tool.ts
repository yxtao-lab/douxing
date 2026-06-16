import { retrieveAttractionsForPlanning } from '../../services/attraction-rag.service.js';
import { retrieveAttractionsInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runRetrieveAttractionsTool(raw: unknown) {
  const parsed = retrieveAttractionsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const candidates = await retrieveAttractionsForPlanning(parsed.data);
  return toolSuccess({ candidates });
}
