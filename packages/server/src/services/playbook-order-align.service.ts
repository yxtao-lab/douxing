/**
 * H9+-3：玩法动线 POI 顺序 soft 对齐（classicOrder）
 */
import type { LocaleCode, RouteDayAttraction } from '@douxing/shared';
import { formatEnricherWarning } from '@douxing/shared';
import type { MatchedRoutePlaybook, RoutePlaybook } from './playbook-rag.service.js';

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase();
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function findClassicIndex(name: string, classicOrder: string[]): number {
  return classicOrder.findIndex((token) => namesMatch(name, token));
}

/** 为当日 POI 挑选最匹配的 playbook（≥2 个 POI 命中） */
export function pickPlaybookForDayPois(
  playbooks: MatchedRoutePlaybook[],
  spotNames: string[],
  dayTitle?: string,
): RoutePlaybook | null {
  if (playbooks.length === 0) return null;

  let best: RoutePlaybook | null = null;
  let bestHits = 0;

  for (const { playbook } of playbooks) {
    let hits = 0;
    for (const spot of spotNames) {
      if (findClassicIndex(spot, playbook.classicOrder) >= 0) hits += 1;
    }
    if (dayTitle && (dayTitle.includes(playbook.scope) || playbook.keywords.some((k) => dayTitle.includes(k)))) {
      hits += 1;
    }
    if (hits >= 2 && hits > bestHits) {
      best = playbook;
      bestHits = hits;
    }
  }

  return best;
}

/** 统计 classicOrder 命中 POI 的逆序对数（越大越乱序） */
export function countClassicOrderInversions(
  spots: Pick<RouteDayAttraction, 'name'>[],
  classicOrder: string[],
): number {
  const indices = spots
    .map((spot) => findClassicIndex(spot.name, classicOrder))
    .filter((idx) => idx >= 0);

  let inversions = 0;
  for (let i = 0; i < indices.length; i += 1) {
    for (let j = i + 1; j < indices.length; j += 1) {
      if (indices[i]! > indices[j]!) inversions += 1;
    }
  }
  return inversions;
}

/** 按 classicOrder 重排：先经典序，未命中项保持原相对顺序接在后面 */
export function reorderPoisByClassicOrder(
  spots: RouteDayAttraction[],
  classicOrder: string[],
): RouteDayAttraction[] {
  const remaining = [...spots];
  const ordered: RouteDayAttraction[] = [];

  for (const token of classicOrder) {
    const idx = remaining.findIndex((spot) => namesMatch(spot.name, token));
    if (idx >= 0) {
      ordered.push(remaining[idx]!);
      remaining.splice(idx, 1);
    }
  }

  return [...ordered, ...remaining];
}

export interface SoftAlignDayPoisResult {
  attractions: RouteDayAttraction[];
  reordered: boolean;
  playbookId?: string;
  scope?: string;
  warnings: string[];
}

/** Enricher：对 playbook 经典动线做 soft 对齐（乱序则重排并 warning） */
export function softAlignDayPoisToPlaybook(
  spots: RouteDayAttraction[],
  playbooks: MatchedRoutePlaybook[],
  locale: LocaleCode,
  dayTitle?: string,
): SoftAlignDayPoisResult {
  if (spots.length < 2 || playbooks.length === 0) {
    return { attractions: spots, reordered: false, warnings: [] };
  }

  const playbook = pickPlaybookForDayPois(
    playbooks,
    spots.map((spot) => spot.name),
    dayTitle,
  );
  if (!playbook) {
    return { attractions: spots, reordered: false, warnings: [] };
  }

  const inversions = countClassicOrderInversions(spots, playbook.classicOrder);
  if (inversions === 0) {
    return { attractions: spots, reordered: false, warnings: [] };
  }

  const reorderedSpots = reorderPoisByClassicOrder(spots, playbook.classicOrder);
  const warning = formatEnricherWarning('playbookOrderAdjusted', locale, {
    name: playbook.scope,
    scope: playbook.scope,
  });

  return {
    attractions: reorderedSpots,
    reordered: true,
    playbookId: playbook.id,
    scope: playbook.scope,
    warnings: [warning],
  };
}

/** 对齐得分：1 = 完全按 classicOrder，0 = 最大乱序 */
export function computeClassicOrderAlignmentScore(
  spots: Pick<RouteDayAttraction, 'name'>[],
  classicOrder: string[],
): number {
  const indices = spots
    .map((spot) => findClassicIndex(spot.name, classicOrder))
    .filter((idx) => idx >= 0);

  if (indices.length < 2) return 1;

  const inversions = countClassicOrderInversions(spots, classicOrder);
  const maxInversions = (indices.length * (indices.length - 1)) / 2;
  return maxInversions === 0 ? 1 : 1 - inversions / maxInversions;
}
