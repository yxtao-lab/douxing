import { retrieveAttractionsForPlanning } from '../../services/attraction-rag.service.js';
import { retrieveAttractionsInputSchema, toolFail, toolSuccess } from './schemas.js';

/**
 * 执行景点 RAG 检索 Tool，并返回命中 POI 明细供 NodeSpan trace。
 *
 * @param raw - Tool 入参（city/themes/prompt 等）
 * @returns 候选列表 + matchedIds + ragScoreSummary；校验失败时返回 toolFail
 */
export async function runRetrieveAttractionsTool(raw: unknown) {
  const parsed = retrieveAttractionsInputSchema.safeParse(raw);
  if (!parsed.success) {
    return toolFail(parsed.error.message, 'INVALID_INPUT');
  }

  const candidates = await retrieveAttractionsForPlanning({
    ...parsed.data,
    days: parsed.data.days ?? undefined,
    limit: parsed.data.limit ?? undefined,
    mmrLambda: parsed.data.mmrLambda ?? undefined,
  });
  const matchedIds = candidates.map((item) => item.id);
  const ragScoreSummary = candidates.slice(0, 20).map((item) => ({
    id: item.id,
    score: item.score,
    name: item.name,
  }));

  return toolSuccess({
    candidates,
    matchedIds,
    ragScoreSummary,
  });
}
