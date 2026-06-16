/**
 * Phase 0-c：规划质量指标（POI 命中率等）上报埋点
 */
import { AnalyticsEventCategory, AnalyticsEventSource } from '@douxing/shared';
import { trackAnalyticsEvent } from './analytics.service.js';
import {
  computePoiHitRate,
  draftToLlmTrainingPayload,
} from './training-data.service.js';
import type { GeneratedRouteDraft } from './route-generator.service.js';
import type { RagAttractionCandidate } from '@douxing/shared';

const POI_HIT_RATE_FALLBACK_THRESHOLD = 0.8;

export function resolvePoiHitRate(
  draft: GeneratedRouteDraft,
  ragCandidates: RagAttractionCandidate[],
): number {
  const payload = draftToLlmTrainingPayload(draft);
  return computePoiHitRate(payload, ragCandidates);
}

export function shouldFallbackToRagCatalog(
  hitRate: number,
  threshold = POI_HIT_RATE_FALLBACK_THRESHOLD,
): boolean {
  return hitRate < threshold;
}

export async function recordPlanQualityMetrics(input: {
  userId?: number;
  routeId?: number;
  sessionId?: number;
  poiHitRate: number;
  ragMatchedCount: number;
  ragCandidateCount: number;
  generationSource: 'llm' | 'template';
  matchedCity?: string;
  lodgingContentLibraryRatio?: number;
}): Promise<void> {
  try {
    await trackAnalyticsEvent({
      eventName: 'plan_route_quality',
      eventCategory: AnalyticsEventCategory.BUSINESS,
      source: AnalyticsEventSource.SERVER,
      userId: input.userId,
      properties: {
        routeId: input.routeId,
        sessionId: input.sessionId,
        poiHitRate: Math.round(input.poiHitRate * 1000) / 1000,
        ragMatchedCount: input.ragMatchedCount,
        ragCandidateCount: input.ragCandidateCount,
        generationSource: input.generationSource,
        matchedCity: input.matchedCity ?? '',
        lodgingContentLibraryRatio: input.lodgingContentLibraryRatio ?? null,
      },
    });
  } catch (err) {
    console.warn(
      '[route-quality-metrics] 上报失败:',
      err instanceof Error ? err.message : err,
    );
  }
}

export function computeLodgingContentLibraryRatio(
  draft: GeneratedRouteDraft,
): number {
  const days = draft.routeDetail.days;
  if (days.length === 0) return 0;
  const withLodging = days.filter((d) => d.lodging);
  if (withLodging.length === 0) return 0;
  const fromLibrary = withLodging.filter(
    (d) => d.lodging?.source === 'content_library',
  ).length;
  return fromLibrary / withLodging.length;
}
