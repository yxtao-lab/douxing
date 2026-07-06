import { eq, desc, and } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  RouteStatus,
  detectExternalDiscussionPlatform,
  isAllowedExternalDiscussionUrl,
  type RoutePoiExternalLinkInfo,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { routePoiExternalLinks } from '../db/schema/route-poi-external-links.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';

/** 外链列表查询选项 */
export interface ListRoutePoiExternalLinksOptions {
  limit?: number;
  dayIndex?: number;
  attractionId?: number;
  poiName?: string;
}

/** 创建外链时的 POI 上下文 */
export interface CreateRoutePoiExternalLinkInput {
  title: string;
  url: string;
  dayIndex?: number;
  attractionId?: number;
  poiName?: string;
}

/**
 * 判断用户是否可在该路线添加/查看外链（公开已发布或本人）。
 *
 * @param routeId - 路线 ID
 * @param userId - 用户 ID
 * @returns 路线行或 `null`
 */
async function getLinkableRoute(routeId: number, userId: number) {
  const db = getDb();
  const rows = await db.select().from(travelRoutes).where(eq(travelRoutes.id, routeId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.creatorId === userId) return row;
  if (row.status === RouteStatus.PUBLISHED && row.isPublic === 1) return row;
  return null;
}

/**
 * 将外链行映射为 API 结构。
 *
 * @param row - 联表查询行
 * @returns 前端可用的外链信息
 */
function toExternalLinkInfo(row: {
  id: number;
  routeId: number;
  userId: number;
  dayIndex: number | null;
  attractionId: number | null;
  poiName: string | null;
  title: string;
  url: string;
  platform: string;
  createdAt: Date;
  userNickname: string;
}): RoutePoiExternalLinkInfo {
  const platform = row.platform as RoutePoiExternalLinkInfo['platform'];
  return {
    id: row.id,
    routeId: row.routeId,
    userId: row.userId,
    userNickname: row.userNickname,
    dayIndex: row.dayIndex,
    attractionId: row.attractionId,
    poiName: row.poiName,
    title: row.title,
    url: row.url,
    platform:
      platform === 'xiaohongshu' || platform === 'douyin' || platform === 'bilibili'
        ? platform
        : 'other',
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 列出路线 POI 外链讨论。
 *
 * @param routeId - 路线 ID
 * @param viewerUserId - 当前用户（鉴权用）
 * @param options - 筛选与 limit
 * @returns 外链列表；无权查看时返回 `null`
 */
export async function listRoutePoiExternalLinks(
  routeId: number,
  viewerUserId: number,
  options: ListRoutePoiExternalLinksOptions = {},
): Promise<RoutePoiExternalLinkInfo[] | null> {
  const route = await getLinkableRoute(routeId, viewerUserId);
  if (!route) return null;

  const db = getDb();
  const safeLimit = Math.min(Math.max(options.limit ?? 30, 1), 50);
  const conditions = [eq(routePoiExternalLinks.routeId, routeId)];

  if (options.attractionId != null && Number.isFinite(options.attractionId)) {
    conditions.push(eq(routePoiExternalLinks.attractionId, options.attractionId));
  } else if (options.poiName?.trim()) {
    conditions.push(eq(routePoiExternalLinks.poiName, options.poiName.trim().slice(0, 128)));
  } else if (options.dayIndex != null && Number.isFinite(options.dayIndex)) {
    conditions.push(eq(routePoiExternalLinks.dayIndex, options.dayIndex));
  }

  const rows = await db
    .select({
      id: routePoiExternalLinks.id,
      routeId: routePoiExternalLinks.routeId,
      userId: routePoiExternalLinks.userId,
      dayIndex: routePoiExternalLinks.dayIndex,
      attractionId: routePoiExternalLinks.attractionId,
      poiName: routePoiExternalLinks.poiName,
      title: routePoiExternalLinks.title,
      url: routePoiExternalLinks.url,
      platform: routePoiExternalLinks.platform,
      createdAt: routePoiExternalLinks.createdAt,
      userNickname: users.nickname,
    })
    .from(routePoiExternalLinks)
    .innerJoin(users, eq(routePoiExternalLinks.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(routePoiExternalLinks.createdAt))
    .limit(safeLimit);

  return rows.map(toExternalLinkInfo);
}

/**
 * 为路线 POI 添加外链讨论（H10-d）。
 *
 * @param routeId - 路线 ID
 * @param userId - 提交用户
 * @param input - 标题、URL 与 POI 上下文
 * @returns 新外链；路线不可添加时为 `null`
 * @throws {ApiError} URL 非法时抛出 `ROUTE_POI_LINK_INVALID_URL`
 */
export async function createRoutePoiExternalLink(
  routeId: number,
  userId: number,
  input: CreateRoutePoiExternalLinkInput,
): Promise<RoutePoiExternalLinkInfo | null> {
  const route = await getLinkableRoute(routeId, userId);
  if (!route) return null;

  const title = input.title.trim().slice(0, 128);
  const url = input.url.trim().slice(0, 512);
  if (!title || !isAllowedExternalDiscussionUrl(url)) {
    throw new ApiError(ApiMessageKey.ROUTE_POI_LINK_INVALID_URL);
  }

  const dayIndex =
    input.dayIndex != null && Number.isFinite(input.dayIndex)
      ? Math.max(0, Math.min(29, Math.floor(input.dayIndex)))
      : null;
  const attractionId =
    input.attractionId != null && Number.isFinite(input.attractionId) && input.attractionId > 0
      ? Math.floor(input.attractionId)
      : null;
  const poiName = input.poiName?.trim().slice(0, 128) || null;
  const platform = detectExternalDiscussionPlatform(url);

  const db = getDb();
  const [result] = await db.insert(routePoiExternalLinks).values({
    routeId,
    userId,
    dayIndex,
    attractionId,
    poiName,
    title,
    url,
    platform,
  });

  const linkId = Number(result.insertId);
  const rows = await db
    .select({
      id: routePoiExternalLinks.id,
      routeId: routePoiExternalLinks.routeId,
      userId: routePoiExternalLinks.userId,
      dayIndex: routePoiExternalLinks.dayIndex,
      attractionId: routePoiExternalLinks.attractionId,
      poiName: routePoiExternalLinks.poiName,
      title: routePoiExternalLinks.title,
      url: routePoiExternalLinks.url,
      platform: routePoiExternalLinks.platform,
      createdAt: routePoiExternalLinks.createdAt,
      userNickname: users.nickname,
    })
    .from(routePoiExternalLinks)
    .innerJoin(users, eq(routePoiExternalLinks.userId, users.id))
    .where(eq(routePoiExternalLinks.id, linkId))
    .limit(1);

  const row = rows[0];
  return row ? toExternalLinkInfo(row) : null;
}

/**
 * 删除 POI 外链讨论（提交者或路线作者可删）。
 *
 * @param routeId - 路线 ID
 * @param linkId - 外链 ID
 * @param userId - 操作用户
 * @returns 是否删除成功
 */
export async function deleteRoutePoiExternalLink(
  routeId: number,
  linkId: number,
  userId: number,
): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select({
      id: routePoiExternalLinks.id,
      userId: routePoiExternalLinks.userId,
    })
    .from(routePoiExternalLinks)
    .where(and(eq(routePoiExternalLinks.id, linkId), eq(routePoiExternalLinks.routeId, routeId)))
    .limit(1);
  const link = rows[0];
  if (!link) return false;

  const routeRows = await db
    .select({ creatorId: travelRoutes.creatorId })
    .from(travelRoutes)
    .where(eq(travelRoutes.id, routeId))
    .limit(1);
  const creatorId = routeRows[0]?.creatorId;
  if (link.userId !== userId && creatorId !== userId) return false;

  await db.delete(routePoiExternalLinks).where(eq(routePoiExternalLinks.id, linkId));
  return true;
}
