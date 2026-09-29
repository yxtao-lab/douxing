/**
 * U4：验证积分规则（与热度、可信度三套账分离）。
 * 金额集中配置，禁止业务散落魔法数。
 */

/** 验证积分事件类型 */
export const VerificationPointEventType = {
  /** 上传/发布灵感稿（低分，防灌水） */
  INSPIRATION_PUBLISH: 'inspiration_publish',
  /** 他人跟走完成关键节点（给作者高分） */
  FOLLOW_COMPLETE: 'follow_complete',
  /** 纠错被采纳 / 时效更新确认 */
  CORRECTION_ACCEPTED: 'correction_accepted',
  /** 路线升级为可出行稿（一次性） */
  TRAVEL_READY_UPGRADE: 'travel_ready_upgrade',
  /** 打卡：路线关键节点 */
  CHECKIN_KEY_NODE: 'checkin_key_node',
  /** 打卡：首次 POI */
  CHECKIN_FIRST_POI: 'checkin_first_poi',
  /** 打卡：带图/相册优质证据 */
  CHECKIN_QUALITY: 'checkin_quality',
} as const;

export type VerificationPointEventTypeValue =
  (typeof VerificationPointEventType)[keyof typeof VerificationPointEventType];

/** 各事件默认入账分值 */
export const VERIFICATION_POINT_AMOUNTS = {
  [VerificationPointEventType.INSPIRATION_PUBLISH]: 5,
  [VerificationPointEventType.FOLLOW_COMPLETE]: 50,
  [VerificationPointEventType.CORRECTION_ACCEPTED]: 30,
  [VerificationPointEventType.TRAVEL_READY_UPGRADE]: 80,
  [VerificationPointEventType.CHECKIN_KEY_NODE]: 15,
  [VerificationPointEventType.CHECKIN_FIRST_POI]: 10,
  [VerificationPointEventType.CHECKIN_QUALITY]: 5,
} as const;

/**
 * 跟走完成：至少打卡的关键节点数下限。
 * 实际所需 = min(本路线关键节点数, 该下限)。
 */
export const FOLLOW_COMPLETE_MIN_KEY_NODES = 2;

/** 打卡验证分组成部分 */
export interface CheckInVerificationPart {
  eventType: VerificationPointEventTypeValue;
  points: number;
}

/** 单次打卡可入账的验证分计算结果 */
export interface CheckInVerificationAward {
  /** 合计分；同点已入账过则为 0 */
  total: number;
  parts: CheckInVerificationPart[];
  /** 是否因同点已入账而跳过 */
  skippedDuplicatePoi: boolean;
  reasonKeys: Array<'key_node' | 'first_poi' | 'quality' | 'duplicate_poi'>;
}

/**
 * 从行程 JSON 提取关键节点（每天首尾绑定景点库的 attractionId，去重保序）。
 *
 * @param routeDetail - 路线 routeDetail
 * @returns 关键景点 ID 列表
 */
export function extractRouteKeyAttractionIds(routeDetail: unknown): number[] {
  const raw =
    routeDetail && typeof routeDetail === 'object'
      ? (routeDetail as Record<string, unknown>)
      : {};
  const days = Array.isArray(raw.days) ? raw.days : [];
  const ids: number[] = [];
  const seen = new Set<number>();

  for (const day of days) {
    if (!day || typeof day !== 'object') continue;
    const attractions = (day as { attractions?: unknown }).attractions;
    if (!Array.isArray(attractions) || attractions.length === 0) continue;

    const bound: number[] = [];
    for (const spot of attractions) {
      if (!spot || typeof spot !== 'object') continue;
      const attractionId = (spot as { attractionId?: unknown }).attractionId;
      if (typeof attractionId === 'number' && attractionId > 0) {
        bound.push(attractionId);
      }
    }
    if (bound.length === 0) continue;

    const dayKeys = bound.length === 1 ? [bound[0]!] : [bound[0]!, bound[bound.length - 1]!];
    for (const id of dayKeys) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

/**
 * 计算跟走完成所需的最少关键节点打卡数。
 *
 * @param keyNodeCount - 路线关键节点总数
 * @returns 门槛（至少 1，若无关键节点则为 0 表示不可触发）
 */
export function resolveFollowCompleteThreshold(keyNodeCount: number): number {
  const total = Math.max(0, Math.floor(keyNodeCount));
  if (total <= 0) return 0;
  return Math.min(total, FOLLOW_COMPLETE_MIN_KEY_NODES);
}

/**
 * 构建幂等去重键（落库 unique）。
 *
 * @param parts - 键片段
 * @returns 去重键
 */
export function buildVerificationPointDedupeKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => (part == null || part === '' ? '_' : String(part)))
    .join(':');
}

/**
 * 计算打卡应得的验证分（纯函数，不做落库）。
 * 同一用户在同一路线同一 POI 仅首次可得分；纯点赞不计分。
 *
 * @param input.isFirstAtAttraction - 是否该用户首次打卡该景点（全局）
 * @param input.isKeyNode - 是否路线关键节点
 * @param input.hasPhotos - 是否带图/相册证据
 * @param input.alreadyAwardedForPoi - 该用户在本路线本 POI 是否已入过打卡验证分
 * @returns 合计与拆解；重复同点时 total=0
 */
export function computeCheckInVerificationAward(input: {
  isFirstAtAttraction: boolean;
  isKeyNode: boolean;
  hasPhotos: boolean;
  alreadyAwardedForPoi: boolean;
}): CheckInVerificationAward {
  if (input.alreadyAwardedForPoi) {
    return {
      total: 0,
      parts: [],
      skippedDuplicatePoi: true,
      reasonKeys: ['duplicate_poi'],
    };
  }

  const parts: CheckInVerificationPart[] = [];
  const reasonKeys: CheckInVerificationAward['reasonKeys'] = [];

  if (input.isKeyNode) {
    parts.push({
      eventType: VerificationPointEventType.CHECKIN_KEY_NODE,
      points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CHECKIN_KEY_NODE],
    });
    reasonKeys.push('key_node');
  }
  if (input.isFirstAtAttraction) {
    parts.push({
      eventType: VerificationPointEventType.CHECKIN_FIRST_POI,
      points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CHECKIN_FIRST_POI],
    });
    reasonKeys.push('first_poi');
  }
  if (input.hasPhotos) {
    parts.push({
      eventType: VerificationPointEventType.CHECKIN_QUALITY,
      points: VERIFICATION_POINT_AMOUNTS[VerificationPointEventType.CHECKIN_QUALITY],
    });
    reasonKeys.push('quality');
  }

  const total = parts.reduce((sum, part) => sum + part.points, 0);
  return { total, parts, skippedDuplicatePoi: false, reasonKeys };
}

/**
 * 判断事件类型是否为「打卡类」（用于同点去重查询）。
 *
 * @param eventType - 事件类型
 * @returns 是否打卡类
 */
export function isCheckInVerificationEventType(eventType: string): boolean {
  return (
    eventType === VerificationPointEventType.CHECKIN_KEY_NODE ||
    eventType === VerificationPointEventType.CHECKIN_FIRST_POI ||
    eventType === VerificationPointEventType.CHECKIN_QUALITY
  );
}
