import type { RouteCommentInfo, RouteDayAttraction } from './types.js';

/**
 * 合并路线内联说明与景点库说明，优先展示更完整可信的文案。
 *
 * @param inlineDescription - `route_detail` 内 POI 说明
 * @param catalogDescription - 景点库 `attractions.description`
 * @returns 用于 UI 展示的合并说明；两者皆空时返回空字符串
 */
export function resolvePoiDisplayDescription(
  inlineDescription: string | undefined,
  catalogDescription: string | null | undefined,
): string {
  const inline = inlineDescription?.trim() ?? '';
  const catalog = catalogDescription?.trim() ?? '';
  if (!catalog) return inline;
  if (!inline) return catalog;
  if (catalog.length >= inline.length) return catalog;
  if (inline.includes(catalog)) return inline;
  return `${inline}\n\n${catalog}`;
}

/**
 * 构建路线 POI 在 UI 层的稳定键（用于展开态、评论聚焦）。
 *
 * @param dayIndex - 行程天索引（0-based）
 * @param spot - POI 节点
 * @returns 唯一键字符串
 */
export function buildRoutePoiKey(
  dayIndex: number,
  spot: Pick<RouteDayAttraction, 'name' | 'attractionId'>,
): string {
  return `${dayIndex}::${spot.attractionId ?? 'n'}::${spot.name.trim()}`;
}

/** H10-a 评论筛选条件 */
export interface RouteCommentFilter {
  dayIndex?: number | null;
  attractionId?: number | null;
  poiName?: string | null;
}

/**
 * 客户端对全量评论做 POI/天筛选（与服务端 query 语义一致）。
 *
 * @param comments - 评论列表
 * @param filter - 筛选条件；皆空时返回原列表
 * @returns 过滤后的评论
 */
export function filterRouteComments(
  comments: RouteCommentInfo[],
  filter: RouteCommentFilter,
): RouteCommentInfo[] {
  if (filter.attractionId != null) {
    return comments.filter((item) => item.attractionId === filter.attractionId);
  }
  if (filter.poiName?.trim()) {
    const name = filter.poiName.trim();
    return comments.filter((item) => item.poiName?.trim() === name);
  }
  if (filter.dayIndex != null) {
    return comments.filter((item) => item.dayIndex === filter.dayIndex);
  }
  return comments;
}

/**
 * 判断 POI 是否具备 H10-a 信任链展示素材（库说明或他人打卡图）。
 *
 * @param spot - 路线 POI 节点
 * @returns 是否应在详情中提供展开入口
 */
export function hasPoiTrustContent(spot: RouteDayAttraction): boolean {
  return Boolean(
    spot.catalogDescription?.trim() ||
      (spot.checkInPhotoUrls?.length ?? 0) > 0 ||
      spot.description?.trim(),
  );
}
