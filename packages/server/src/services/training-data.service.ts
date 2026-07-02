import { PoiCategory } from '@douxing/shared';
import type { RagAttractionCandidate } from '@douxing/shared';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import {
  buildRoutePlannerMessages,
  llmRouteSchema,
  type LlmRoutePayload,
  type RoutePlannerMessageOptions,
} from './llm-client.service.js';
import { matchRagCandidateBySpotName } from './attraction-rag.service.js';

export interface TrainingSample {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
}

export function draftToLlmTrainingPayload(draft: GeneratedRouteDraft): LlmRoutePayload {
  return {
    name: draft.name,
    description: draft.description,
    budgetRange: draft.budgetRange,
    days: draft.days,
    interestTags: draft.interestTags,
    matchedCity: draft.matchedCity,
    unlockPrice: draft.unlockPrice,
    routeDetail: {
      days: draft.routeDetail.days.map((day) => ({
        date: day.date,
        title: day.title,
        attractions: day.attractions
          .filter(
            (spot) =>
              spot.poiType !== PoiCategory.HOTEL && spot.poiType !== PoiCategory.TRANSPORT,
          )
          .map((spot) => ({
            name: spot.name,
            time: spot.time ?? '',
            cost: spot.cost,
            description: spot.description,
            poiType: spot.poiType as LlmRoutePayload['routeDetail']['days'][0]['attractions'][0]['poiType'],
            ...(spot.latitude != null ? { latitude: spot.latitude } : {}),
            ...(spot.longitude != null ? { longitude: spot.longitude } : {}),
          })),
      })),
    },
  };
}

export function buildTrainingSample(
  userPrompt: string,
  draft: GeneratedRouteDraft,
  options: RoutePlannerMessageOptions,
): TrainingSample {
  const payload = draftToLlmTrainingPayload(draft);
  const messages = buildRoutePlannerMessages(userPrompt, options);
  return {
    messages: [
      ...messages,
      { role: 'assistant', content: JSON.stringify(payload) },
    ],
  };
}

/**
 * 计算路线中 attraction 节点命中 RAG 白名单的比例（含别名与模糊名匹配）。
 *
 * @param payload - LLM 路线 JSON 结构
 * @param ragCandidates - 内容库候选 POI
 * @returns 0–1；无 attraction 节点时返回 1
 */
export function computePoiHitRate(
  payload: LlmRoutePayload,
  ragCandidates: RagAttractionCandidate[],
): number {
  const attractions = payload.routeDetail.days.flatMap((day) =>
    day.attractions.filter((s) => s.poiType === PoiCategory.ATTRACTION),
  );
  if (attractions.length === 0) return 1;
  if (ragCandidates.length === 0) return 0;
  const hits = attractions.filter((s) =>
    matchRagCandidateBySpotName(s.name, ragCandidates),
  ).length;
  return hits / attractions.length;
}

export interface TrainingValidationResult {
  ok: boolean;
  errors: string[];
  poiHitRate: number;
}

export function validateTrainingSample(
  sample: TrainingSample,
  ragCandidates: RagAttractionCandidate[] = [],
  minPoiHitRate = 0.9,
): TrainingValidationResult {
  const errors: string[] = [];
  const assistant = sample.messages.find((m) => m.role === 'assistant');
  if (!assistant?.content.trim()) {
    return { ok: false, errors: ['缺少 assistant 消息'], poiHitRate: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(assistant.content);
  } catch {
    return { ok: false, errors: ['assistant 不是合法 JSON'], poiHitRate: 0 };
  }

  const result = llmRouteSchema.safeParse(parsed);
  if (!result.success) {
    errors.push(result.error.errors[0]?.message ?? 'schema 校验失败');
    return { ok: false, errors, poiHitRate: 0 };
  }

  const poiHitRate = computePoiHitRate(result.data, ragCandidates);
  if (ragCandidates.length > 0 && poiHitRate < minPoiHitRate) {
    errors.push(`POI 命中率 ${(poiHitRate * 100).toFixed(0)}% 低于 ${minPoiHitRate * 100}%`);
  }

  if (result.data.routeDetail.days.length !== result.data.days) {
    errors.push('days 与 routeDetail.days 长度不一致');
  }

  return { ok: errors.length === 0, errors, poiHitRate };
}
