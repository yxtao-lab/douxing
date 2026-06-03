import type { LocaleCode, RouteDayPlan, RouteDetailPayload, TravelRouteInfo } from '@douxing/shared';
import type { PosterDayBlock, PosterLabels, PosterPayload, PosterPoiItem, PosterRenderOptions } from './types';
import { buildRouteShareUrl } from './share-url';
import { MAX_HIGHLIGHT_IMAGES_PER_DAY } from './draw-poster-images';
import { buildRouteDayFlow, type RouteFlowNode } from '@/utils/route-day-flow';
import {
  applyShowTimeToItems,
  limitDayItemsByPlayCount,
  mergePosterRenderOptions,
  themeColorForDay,
} from './poster-options';

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

function buildDayBlocks(
  days: RouteDayPlan[],
  locale: LocaleCode,
  labels: PosterLabels,
  options: PosterRenderOptions,
): PosterDayBlock[] {
  return days.map((day, index) => {
    const dayNo = index + 1;
    const label =
      day.title?.trim() ||
      day.date?.trim() ||
      (locale === 'en-US' ? `${labels.dayPrefix} ${dayNo}` : `第 ${dayNo} 天`);

    const flowNodes = buildRouteDayFlow(day);
    const allItems = flowNodes.map((node) => flowNodeToPosterItem(node, labels));
    const { items: limitedItems, hiddenItemCount } = limitDayItemsByPlayCount(
      allItems,
      options.poisPerDay,
    );
    const items = applyShowTimeToItems(limitedItems, options.showTime);

    const visibleNodes = flowNodes.filter((node, i) => {
      if (node.kind !== 'play') {
        const playBefore = flowNodes.slice(0, i).filter((n) => n.kind === 'play').length;
        return playBefore < options.poisPerDay;
      }
      const playIndex = flowNodes.slice(0, i + 1).filter((n) => n.kind === 'play').length - 1;
      return playIndex < options.poisPerDay;
    });

    return {
      label,
      themeColor: themeColorForDay(options.themePresetId, index),
      items,
      highlightImages: collectDayHighlightImages(visibleNodes),
      hiddenItemCount,
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
  options?: Partial<PosterRenderOptions>;
}

/** 从路线详情抽取统一 PosterPayload（含交通 / 游玩 / 住宿，与行程路径一致） */
export function buildPosterPayload(input: BuildPosterPayloadInput): PosterPayload | null {
  const detail = input.route.routeDetail as RouteDetailPayload | null;
  const days = detail?.days ?? [];
  if (days.length === 0) return null;

  const options = mergePosterRenderOptions(input.options);
  const city = detail?.matchedCity?.trim() || input.route.budgetRange?.trim() || '—';
  const dayCount = input.route.days || days.length;
  const labels = buildLabels(input.locale, dayCount);

  const subtitleFromRoute = (input.route.description ?? '').trim();
  const subtitle =
    options.subtitleOverride !== undefined
      ? options.subtitleOverride.trim()
      : subtitleFromRoute;

  return {
    routeId: input.route.id,
    city,
    title: input.route.name?.trim() || '—',
    subtitle,
    dayCount,
    days: buildDayBlocks(days, input.locale, labels, options),
    hiddenDayCount: 0,
    brand: {
      name: input.brandName,
      tagline: input.brandTagline,
      scanHint: input.scanHint,
    },
    qrUrl: buildRouteShareUrl(input.route.id),
    locale: input.locale,
    labels,
    options,
  };
}
