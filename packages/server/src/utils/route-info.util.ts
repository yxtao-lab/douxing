import { travelRoutes } from '../db/schema/travel-routes.js';
import { RouteStatus, computeRouteHeatScore } from '@douxing/shared';
import type { TravelRouteInfo, RouteTrustBreakdown } from '@douxing/shared';
import { isRouteUnlockPaymentRequired } from '../config/route-unlock.js';

export type RouteInfoViewerOptions = {
  viewerId?: number;
};

function buildRouteDetailForViewer(
  row: typeof travelRoutes.$inferSelect,
  viewerId?: number,
): Record<string, unknown> | null {
  const raw = row.routeDetail as Record<string, unknown> | null;
  if (!raw) return null;

  const isOwner = viewerId !== undefined && row.creatorId === viewerId;
  const isPublicVisitor =
    !isOwner && row.isPublic === 1 && row.status === RouteStatus.PUBLISHED;

  const detail = { ...raw };
  if (isPublicVisitor) {
    detail.isUnlocked = true;
  } else if (isOwner && !isRouteUnlockPaymentRequired()) {
    detail.isUnlocked = true;
  }
  if (!isOwner) {
    delete detail.sourcePrompt;
    delete detail.llmProviderChoice;
  }
  return detail;
}

export function toRouteInfo(
  row: typeof travelRoutes.$inferSelect,
  options?: RouteInfoViewerOptions,
): TravelRouteInfo {
  const detail = buildRouteDetailForViewer(row, options?.viewerId);
  const detailMeta = detail ?? (row.routeDetail as Record<string, unknown> | null);

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    budgetRange: row.budgetRange,
    days: row.days,
    interestTags: row.interestTags,
    sceneTags: row.sceneTags ?? null,
    routeDetail: detail,
    creatorId: row.creatorId,
    status: row.status,
    viewCount: row.viewCount ?? 0,
    likeCount: row.likeCount ?? 0,
    collectCount: row.collectCount ?? 0,
    commentCount: row.commentCount ?? 0,
    isPublic: row.isPublic === 1,
    sourceKind: row.sourceKind,
    contentTier: row.contentTier,
    verificationStatus: row.verificationStatus,
    moderationStatus: row.moderationStatus,
    parentRouteId: row.parentRouteId ?? null,
    pendingVerification:
      row.sourceKind === 'crawl' && row.verificationStatus !== 'verified',
    heatScore: computeRouteHeatScore({
      likeCount: row.likeCount,
      commentCount: row.commentCount,
      collectCount: row.collectCount,
      viewCount: row.viewCount,
    }),
    trustScore: row.trustScore ?? 0,
    trustCrowned: row.trustCrowned === 1,
    trustBreakdown: (row.trustBreakdown as RouteTrustBreakdown | null) ?? null,
    isAiGenerated: detailMeta?.isAiGenerated === true,
    unlockPrice: detailMeta?.unlockPrice as number | undefined,
    isUnlocked:
      !isRouteUnlockPaymentRequired() && options?.viewerId !== undefined && row.creatorId === options.viewerId
        ? true
        : detailMeta?.isUnlocked === true,
    generationSource: detailMeta?.generationSource as TravelRouteInfo['generationSource'],
    llmProvider: detailMeta?.llmProvider as TravelRouteInfo['llmProvider'],
    sourcePrompt:
      options?.viewerId !== undefined && row.creatorId === options.viewerId
        ? ((detailMeta?.sourcePrompt as string | undefined) ?? null)
        : null,
  };
}
