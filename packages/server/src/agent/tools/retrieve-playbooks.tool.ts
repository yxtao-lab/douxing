import { retrievePlaybooksForPlanning } from '../../services/playbook-rag.service.js';
import { retrieveAttractionsInputSchema, toolFail, toolSuccess } from './schemas.js';

/**
 * 执行玩法动线 RAG 检索 Tool，并返回命中 playbook 明细供 NodeSpan trace。
 *
 * @param raw - Tool 入参（city/themes/prompt 等）
 * @returns playbooks + matchedPlaybookIds；校验失败时返回 toolFail
 */
export async function runRetrievePlaybooksTool(raw: unknown) {
  const parsed = retrieveAttractionsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const playbooks = await retrievePlaybooksForPlanning({
    city: parsed.data.city,
    themes: parsed.data.themes,
    prompt: parsed.data.prompt,
    limit: parsed.data.limit ?? undefined,
  });
  const matchedPlaybookIds = playbooks.map((item) => item.playbook.id);

  return toolSuccess({
    playbooks,
    matchedPlaybookIds,
  });
}
