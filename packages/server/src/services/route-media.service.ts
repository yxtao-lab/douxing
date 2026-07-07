import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  CheckInStatus,
  ROUTE_VIDEO_MAX_DURATION_SEC,
  ROUTE_VIDEO_MAX_FILE_BYTES,
  RouteMediaScope,
  type RouteMediaInfo,
  type RouteMediaPendingInfo,
  type RouteVideoBrief,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { routeMedia } from '../db/schema/route-media.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { rewritePublicAssetUrl } from '../utils/public-asset-url.util.js';
import {
  deleteStoredRouteVideo,
  persistRouteVideoBuffer,
} from './route-video-storage.service.js';

export interface UploadRouteMediaInput {
  buffer: Buffer;
  contentType: string;
  byteSize: number;
  durationSec: number;
  scope: 'route' | 'poi';
  dayIndex?: number | null;
  attractionId?: number | null;
  poiName?: string | null;
  coverUrl?: string | null;
}

export interface ApprovedRouteMediaBundle {
  routeVideo: RouteVideoBrief | null;
  poiByAttractionId: Map<number, RouteVideoBrief>;
  poiByDayAndName: Map<string, RouteVideoBrief>;
}

/**
 * 开发环境或显式开关下自动通过审核，便于联调 H10-c。
 *
 * @returns 初始审核状态
 */
function resolveInitialMediaStatus(): number {
  if (process.env.ROUTE_MEDIA_AUTO_APPROVE === 'true') {
    return CheckInStatus.APPROVED;
  }
  if (process.env.NODE_ENV === 'development') {
    return CheckInStatus.APPROVED;
  }
  return CheckInStatus.PENDING;
}

/**
 * 将数据库行映射为 API 响应。
 *
 * @param row - 路线媒体行
 * @returns 前端可用的媒体信息
 */
function toRouteMediaInfo(row: typeof routeMedia.$inferSelect): RouteMediaInfo {
  return {
    id: row.id,
    routeId: row.routeId,
    userId: row.userId,
    scope: row.scope as 'route' | 'poi',
    dayIndex: row.dayIndex,
    attractionId: row.attractionId,
    poiName: row.poiName,
    videoUrl: rewritePublicAssetUrl(row.storedVideoUrl) ?? row.storedVideoUrl,
    coverUrl: row.coverUrl ? rewritePublicAssetUrl(row.coverUrl) : null,
    durationSec: row.durationSec,
    byteSize: row.byteSize,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 将媒体行转为详情注入用的视频摘要。
 *
 * @param row - 路线媒体行
 * @returns 视频摘要
 */
function toVideoBrief(row: typeof routeMedia.$inferSelect): RouteVideoBrief {
  return {
    videoUrl: rewritePublicAssetUrl(row.storedVideoUrl) ?? row.storedVideoUrl,
    coverUrl: row.coverUrl ? rewritePublicAssetUrl(row.coverUrl) : null,
    durationSec: row.durationSec,
  };
}

/**
 * 校验用户是否为路线作者。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @returns 路线行；非作者时为 `null`
 */
async function assertRouteOwner(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelRoutes)
    .where(and(eq(travelRoutes.id, routeId), eq(travelRoutes.creatorId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 规范化 POI 维度的 dayIndex。
 *
 * @param dayIndex - 原始天索引
 * @returns 0–29 或 `null`
 */
function normalizeDayIndex(dayIndex: number | null | undefined): number | null {
  if (dayIndex == null || !Number.isFinite(dayIndex)) return null;
  return Math.max(0, Math.min(29, Math.floor(dayIndex)));
}

/**
 * 构建 POI 视频索引键（无 attractionId 时使用）。
 *
 * @param dayIndex - 行程天
 * @param poiName - POI 名称
 * @returns 索引键
 */
export function buildPoiMediaIndexKey(dayIndex: number, poiName: string): string {
  return `${dayIndex}::${poiName.trim()}`;
}

/**
 * 列出路线媒体；作者可见全部，他人仅可见已通过审核。
 *
 * @param routeId - 路线 ID
 * @param viewerUserId - 当前用户；为路线作者时返回全部状态
 * @returns 媒体列表
 */
export async function listRouteMedia(
  routeId: number,
  viewerUserId?: number,
): Promise<RouteMediaInfo[]> {
  const db = getDb();
  const owner =
    viewerUserId != null
      ? await assertRouteOwner(routeId, viewerUserId)
      : null;

  const rows = await db
    .select()
    .from(routeMedia)
    .where(
      owner
        ? eq(routeMedia.routeId, routeId)
        : and(eq(routeMedia.routeId, routeId), eq(routeMedia.status, CheckInStatus.APPROVED)),
    )
    .orderBy(desc(routeMedia.createdAt));

  return rows.map(toRouteMediaInfo);
}

/**
 * 查询路线已通过审核的视频，用于详情 POI 富化。
 *
 * @param routeId - 路线 ID
 * @returns 整线与 POI 视频索引
 */
export async function listApprovedRouteMediaBundle(
  routeId: number,
): Promise<ApprovedRouteMediaBundle> {
  const db = getDb();
  const rows = await db
    .select()
    .from(routeMedia)
    .where(and(eq(routeMedia.routeId, routeId), eq(routeMedia.status, CheckInStatus.APPROVED)))
    .orderBy(desc(routeMedia.createdAt));

  let routeVideo: RouteVideoBrief | null = null;
  const poiByAttractionId = new Map<number, RouteVideoBrief>();
  const poiByDayAndName = new Map<string, RouteVideoBrief>();

  for (const row of rows) {
    const brief = toVideoBrief(row);
    if (row.scope === RouteMediaScope.ROUTE && !routeVideo) {
      routeVideo = brief;
      continue;
    }
    if (row.scope !== RouteMediaScope.POI) continue;
    if (row.attractionId != null && !poiByAttractionId.has(row.attractionId)) {
      poiByAttractionId.set(row.attractionId, brief);
      continue;
    }
    if (row.poiName?.trim() && row.dayIndex != null) {
      const key = buildPoiMediaIndexKey(row.dayIndex, row.poiName);
      if (!poiByDayAndName.has(key)) {
        poiByDayAndName.set(key, brief);
      }
    }
  }

  return { routeVideo, poiByAttractionId, poiByDayAndName };
}

/**
 * 上传并绑定路线/POI 短视频。
 *
 * @param routeId - 路线 ID
 * @param userId - 上传用户（须为路线作者）
 * @param input - 上传参数
 * @returns 新媒体记录
 * @throws {ApiError} 校验失败或无权上传时
 */
export async function uploadRouteMedia(
  routeId: number,
  userId: number,
  input: UploadRouteMediaInput,
): Promise<RouteMediaInfo> {
  const owner = await assertRouteOwner(routeId, userId);
  if (!owner) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_FORBIDDEN);
  }

  if (!input.buffer?.length) {
    throw new ApiError(ApiMessageKey.ROUTE_VIDEO_REQUIRED);
  }
  if (input.byteSize > ROUTE_VIDEO_MAX_FILE_BYTES) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_FILE_TOO_LARGE);
  }
  if (input.durationSec > ROUTE_VIDEO_MAX_DURATION_SEC) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_DURATION_EXCEEDED);
  }

  const scope = input.scope;
  if (scope !== RouteMediaScope.ROUTE && scope !== RouteMediaScope.POI) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_INVALID_SCOPE);
  }

  const dayIndex = scope === RouteMediaScope.POI ? normalizeDayIndex(input.dayIndex) : null;
  const attractionId =
    scope === RouteMediaScope.POI &&
    input.attractionId != null &&
    Number.isFinite(input.attractionId) &&
    input.attractionId > 0
      ? Math.floor(input.attractionId)
      : null;
  const poiName =
    scope === RouteMediaScope.POI && input.poiName?.trim()
      ? input.poiName.trim().slice(0, 128)
      : null;

  if (scope === RouteMediaScope.POI && attractionId == null && !poiName) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_INVALID_SCOPE);
  }

  const { storedUrl } = await persistRouteVideoBuffer(userId, input.buffer, input.contentType);

  const db = getDb();
  const [result] = await db.insert(routeMedia).values({
    userId,
    routeId,
    scope,
    dayIndex,
    attractionId,
    poiName,
    storedVideoUrl: storedUrl,
    coverUrl: input.coverUrl?.trim() || null,
    durationSec: Math.max(1, Math.floor(input.durationSec)),
    byteSize: input.byteSize,
    status: resolveInitialMediaStatus(),
  });

  const mediaId = Number(result.insertId);
  const rows = await db.select().from(routeMedia).where(eq(routeMedia.id, mediaId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_UPLOAD_FAILED);
  }
  return toRouteMediaInfo(row);
}

/**
 * 删除本人上传的路线媒体。
 *
 * @param routeId - 路线 ID
 * @param mediaId - 媒体 ID
 * @param userId - 当前用户
 * @returns 是否删除成功
 * @throws {ApiError} 无权或不存在时
 */
export async function deleteRouteMedia(
  routeId: number,
  mediaId: number,
  userId: number,
): Promise<boolean> {
  const owner = await assertRouteOwner(routeId, userId);
  if (!owner) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_FORBIDDEN);
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(routeMedia)
    .where(and(eq(routeMedia.id, mediaId), eq(routeMedia.routeId, routeId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_NOT_FOUND);
  }
  if (row.userId !== userId) {
    throw new ApiError(ApiMessageKey.ROUTE_MEDIA_FORBIDDEN);
  }

  await deleteStoredRouteVideo(row.storedVideoUrl);
  await db.delete(routeMedia).where(eq(routeMedia.id, mediaId));
  return true;
}

/**
 * 列出待审核路线媒体（运营端），附带路线名与上传者昵称。
 *
 * @param limit - 最大条数（1～100）
 * @returns 待审列表；无数据时为空数组
 */
export async function listPendingRouteMedia(limit = 50): Promise<RouteMediaPendingInfo[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = await db
    .select({
      media: routeMedia,
      routeName: travelRoutes.name,
      userNickname: users.nickname,
    })
    .from(routeMedia)
    .innerJoin(travelRoutes, eq(routeMedia.routeId, travelRoutes.id))
    .innerJoin(users, eq(routeMedia.userId, users.id))
    .where(eq(routeMedia.status, CheckInStatus.PENDING))
    .orderBy(desc(routeMedia.createdAt))
    .limit(safeLimit);
  return rows.map(({ media, routeName, userNickname }) => ({
    ...toRouteMediaInfo(media),
    routeName,
    userNickname: userNickname?.trim() || '',
  }));
}

/**
 * 更新路线媒体审核状态。
 *
 * @param mediaId - 媒体 ID
 * @param status - CheckInStatus 值
 * @returns 更新后的媒体；不存在时为 `null`
 */
export async function reviewRouteMedia(
  mediaId: number,
  status: number,
): Promise<RouteMediaInfo | null> {
  const db = getDb();
  const allowed: number[] = [CheckInStatus.APPROVED, CheckInStatus.REJECTED, CheckInStatus.PENDING];
  if (!allowed.includes(status)) {
    throw new ApiError(ApiMessageKey.PARAM_ERROR);
  }

  await db.update(routeMedia).set({ status }).where(eq(routeMedia.id, mediaId));
  const rows = await db.select().from(routeMedia).where(eq(routeMedia.id, mediaId)).limit(1);
  const row = rows[0];
  return row ? toRouteMediaInfo(row) : null;
}

/**
 * 批量查询多个路线的已通过 POI 视频（分享/列表场景预留）。
 *
 * @param routeIds - 路线 ID 列表
 * @returns routeId → 媒体 bundle
 */
export async function listApprovedRouteMediaByRouteIds(
  routeIds: number[],
): Promise<Map<number, ApprovedRouteMediaBundle>> {
  const uniqueIds = [...new Set(routeIds.filter((id) => Number.isFinite(id) && id > 0))];
  const result = new Map<number, ApprovedRouteMediaBundle>();
  if (uniqueIds.length === 0) return result;

  const db = getDb();
  const rows = await db
    .select()
    .from(routeMedia)
    .where(
      and(
        inArray(routeMedia.routeId, uniqueIds),
        eq(routeMedia.status, CheckInStatus.APPROVED),
      ),
    )
    .orderBy(desc(routeMedia.createdAt));

  for (const id of uniqueIds) {
    result.set(id, {
      routeVideo: null,
      poiByAttractionId: new Map(),
      poiByDayAndName: new Map(),
    });
  }

  for (const row of rows) {
    const bundle = result.get(row.routeId);
    if (!bundle) continue;
    const brief = toVideoBrief(row);
    if (row.scope === RouteMediaScope.ROUTE && !bundle.routeVideo) {
      bundle.routeVideo = brief;
      continue;
    }
    if (row.scope !== RouteMediaScope.POI) continue;
    if (row.attractionId != null && !bundle.poiByAttractionId.has(row.attractionId)) {
      bundle.poiByAttractionId.set(row.attractionId, brief);
      continue;
    }
    if (row.poiName?.trim() && row.dayIndex != null) {
      const key = buildPoiMediaIndexKey(row.dayIndex, row.poiName);
      if (!bundle.poiByDayAndName.has(key)) {
        bundle.poiByDayAndName.set(key, brief);
      }
    }
  }

  return result;
}
