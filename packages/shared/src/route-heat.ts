/**
 * U2：广场热度分权重（集中配置，禁止业务散落魔法数）。
 *
 * heat = likes·LIKE + comments·COMMENT + collects·COLLECT + views·VIEW
 * 评价（评论）权重大于点赞；浏览权重最低。分享计数尚未落库，暂不计入。
 */
export const ROUTE_HEAT_WEIGHTS = {
  LIKE: 3,
  COMMENT: 4,
  COLLECT: 2,
  VIEW: 1,
} as const;

export type RouteHeatWeightKey = keyof typeof ROUTE_HEAT_WEIGHTS;

/** 计算热度分所需的互动计数 */
export interface RouteHeatStats {
  likeCount?: number | null;
  commentCount?: number | null;
  collectCount?: number | null;
  viewCount?: number | null;
}

/**
 * 按集中权重计算路线热度分（与广场「热门」排序一致）。
 *
 * @param stats - 点赞/评论/收藏/浏览计数
 * @returns 非负热度分
 */
export function computeRouteHeatScore(stats: RouteHeatStats): number {
  const likes = Math.max(0, Number(stats.likeCount) || 0);
  const comments = Math.max(0, Number(stats.commentCount) || 0);
  const collects = Math.max(0, Number(stats.collectCount) || 0);
  const views = Math.max(0, Number(stats.viewCount) || 0);
  return (
    likes * ROUTE_HEAT_WEIGHTS.LIKE +
    comments * ROUTE_HEAT_WEIGHTS.COMMENT +
    collects * ROUTE_HEAT_WEIGHTS.COLLECT +
    views * ROUTE_HEAT_WEIGHTS.VIEW
  );
}
