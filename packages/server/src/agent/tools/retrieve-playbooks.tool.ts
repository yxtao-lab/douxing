import { retrievePlaybooksForPlanning } from '../../services/playbook-rag.service.js';
import { retrieveAttractionsInputSchema, toolFail, toolSuccess } from './schemas.js';

export async function runRetrievePlaybooksTool(raw: unknown) {
  const parsed = retrieveAttractionsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const playbooks = await retrievePlaybooksForPlanning({
    city: parsed.data.city,
    themes: parsed.data.themes,
    prompt: parsed.data.prompt,
  });
  return toolSuccess({ playbooks });
}
