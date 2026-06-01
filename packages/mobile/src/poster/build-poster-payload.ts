import type { LocaleCode, RouteDayPlan, RouteDetailPayload, TravelRouteInfo } from '@douxing/shared';
import type { PosterDayBlock, PosterLabels, PosterPayload, PosterPoiItem } from './types';
import { buildRouteShareUrl } from './share-url';
import { MAX_HIGHLIGHT_IMAGES_PER_DAY } from './draw-poster-images';
import { buildRouteDayFlow, type RouteFlowNode } from '@/utils/route-day-flow';

const DAY_THEME_COLORS = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#1d3557', '#457b9d'];

function collectDayHighlightImages(nodes: RouteFlowNode[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (node.kind !== 'play') continue;
    const url = node.spot?.coverImageUrl?.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= MAX_HIGHLIGHT_IMAGES_PER_DAY) break;
  }
  return urls;
}

function flowNodeToPosterItem(node: RouteFlowNode, labels: PosterLabels): PosterPoiItem {
  let meta: string | undefined;
  if (node.kind === 'transit' && node.transit) {
    meta = labels.transitDuration.replace('{minutes}', String(node.transit.durationMinutes));
  } else if (node.meta && (node.kind === 'play' || node.kind === 'lodging')) {
    meta = `¥${node.meta}`;
  }

  return {
    kind: node.kind,
    time: node.subtitle?.trim() || undefined,
    name: node.title.trim() || '—',
    desc: (node.description ?? '').trim(),
    meta,
    poiType: node.spot?.poiType,
    imageUrl: node.spot?.coverImageUrl,
  };
}

function buildDayBlocks(days: RouteDayPlan[], locale: LocaleCode, labels: PosterLabels): PosterDayBlock[] {
  return days.map((day, index) => {
    const dayNo = index + 1;
    const label =
      day.title?.trim() ||
      day.date?.trim() ||
      (locale === 'en-US' ? `${labels.dayPrefix} ${dayNo}` : `第 ${dayNo} 天`);

    const flowNodes = buildRouteDayFlow(day);
    const items = flowNodes.map((node) => flowNodeToPosterItem(node, labels));

    return {
      label,
      themeColor: DAY_THEME_COLORS[index % DAY_THEME_COLORS.length]!,
      items,
      highlightImages: collectDayHighlightImages(flowNodes),
      hiddenItemCount: 0,
    };
  });
}

function buildLabels(locale: LocaleCode, dayCount: number): PosterLabels {
  if (locale === 'en-US') {
    return {
      dayCount: dayCount === 1 ? '1 day' : `${dayCount} days`,
      moreDays: '+{count} more days',
      moreItems: '+{count} more stops',
      dayPrefix: 'Day',
      sectionPlay: 'Sightseeing',
      sectionTransit: 'Transit',
      sectionLodging: 'Lodging',
      transitDuration: '{minutes} min',
    };
  }
  return {
    dayCount: `${dayCount} 天`,
    moreDays: '还有 {count} 天',
    moreItems: '还有 {count} 项',
    dayPrefix: '第',
    sectionPlay: '游玩',
    sectionTransit: '交通',
    sectionLodging: '住宿',
    transitDuration: '{minutes} 分钟',
  };
}

export interface BuildPosterPayloadInput {
  route: TravelRouteInfo;
  locale: LocaleCode;
  brandName: string;
  brandTagline: string;
  scanHint: string;
  subtitle?: string;
}

/** 从路线详情抽取统一 PosterPayload（含交通 / 游玩 / 住宿，与行程路径一致） */
export function buildPosterPayload(input: BuildPosterPayloadInput): PosterPayload | null {
  const detail = input.route.routeDetail as RouteDetailPayload | null;
  const days = detail?.days ?? [];
  if (days.length === 0) return null;

  const city = detail?.matchedCity?.trim() || input.route.budgetRange?.trim() || '—';
  const dayCount = input.route.days || days.length;
  const labels = buildLabels(input.locale, dayCount);

  return {
    routeId: input.route.id,
    city,
    title: input.route.name?.trim() || '—',
    subtitle: input.subtitle?.trim() || (input.route.description ?? '').trim(),
    dayCount,
    days: buildDayBlocks(days, input.locale, labels),
    hiddenDayCount: 0,
    brand: {
      name: input.brandName,
      tagline: input.brandTagline,
      scanHint: input.scanHint,
    },
    qrUrl: buildRouteShareUrl(input.route.id),
    locale: input.locale,
    labels,
  };
}
