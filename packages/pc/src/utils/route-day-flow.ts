import type {
  RouteDayAttraction,
  RouteDayLodging,
  RouteDayPlan,
  RouteTransitSegment,
} from '@douxing/shared';

export type RouteFlowNodeKind = 'transit' | 'play' | 'lodging';

export interface RouteFlowNode {
  kind: RouteFlowNodeKind;
  sortKey: number;
  title: string;
  subtitle?: string;
  meta?: string;
  description?: string;
  estimated?: boolean;
  intercity?: boolean;
  spot?: RouteDayAttraction;
  lodging?: RouteDayLodging;
  transit?: RouteTransitSegment;
}

/** 解析时刻字符串为分钟（支持 09:00 或 09:00-10:30） */
export function parseMinutesFromTimeStr(time?: string): number {
  if (!time?.trim()) return Number.MAX_SAFE_INTEGER;
  const part = time.includes('-') ? time.split('-')[0]?.trim() : time.trim();
  const [h, m] = part.split(':').map((v) => parseInt(v, 10));
  if (!Number.isFinite(h)) return Number.MAX_SAFE_INTEGER;
  return h * 60 + (m || 0);
}

/** 将单日 plan 按时间序合并为 交通→游玩→住宿 流程节点 */
export function buildRouteDayFlow(day: RouteDayPlan): RouteFlowNode[] {
  const items: RouteFlowNode[] = [];

  for (const seg of day.transit ?? []) {
    items.push({
      kind: 'transit',
      sortKey: parseMinutesFromTimeStr(seg.time),
      title: `${seg.from} → ${seg.to}`,
      subtitle: seg.time,
      meta: `${seg.durationMinutes}`,
      description: seg.description,
      estimated: seg.estimated,
      intercity: seg.kind === 'intercity',
      transit: seg,
    });
  }

  for (const spot of day.attractions ?? []) {
    items.push({
      kind: 'play',
      sortKey: parseMinutesFromTimeStr(spot.time),
      title: spot.name,
      subtitle: spot.time,
      meta: spot.cost != null ? String(spot.cost) : undefined,
      description: spot.description,
      spot,
    });
  }

  if (day.lodging) {
    items.push({
      kind: 'lodging',
      sortKey: parseMinutesFromTimeStr(day.lodging.time),
      title: day.lodging.name,
      subtitle: day.lodging.time,
      meta: day.lodging.cost != null ? String(day.lodging.cost) : undefined,
      description: day.lodging.description,
      lodging: day.lodging,
    });
  }

  const hasTimed = items.some((n) => n.sortKey < Number.MAX_SAFE_INTEGER);
  if (hasTimed) {
    items.sort((a, b) => a.sortKey - b.sortKey);
    return items;
  }

  const fallback: RouteFlowNode[] = [];
  for (const seg of day.transit ?? []) {
    fallback.push({
      kind: 'transit',
      sortKey: fallback.length,
      title: `${seg.from} → ${seg.to}`,
      subtitle: seg.time,
      meta: `${seg.durationMinutes}`,
      description: seg.description,
      estimated: seg.estimated,
      intercity: seg.kind === 'intercity',
      transit: seg,
    });
  }
  for (const spot of day.attractions ?? []) {
    fallback.push({
      kind: 'play',
      sortKey: fallback.length,
      title: spot.name,
      subtitle: spot.time,
      meta: spot.cost != null ? String(spot.cost) : undefined,
      description: spot.description,
      spot,
    });
  }
  if (day.lodging) {
    fallback.push({
      kind: 'lodging',
      sortKey: fallback.length,
      title: day.lodging.name,
      subtitle: day.lodging.time,
      meta: day.lodging.cost != null ? String(day.lodging.cost) : undefined,
      description: day.lodging.description,
      lodging: day.lodging,
    });
  }
  return fallback;
}
