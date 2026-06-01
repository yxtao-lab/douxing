import type { LocaleCode, RouteDayPlan, RouteDetailPayload, TravelRouteInfo } from '@douxing/shared';
import type { PosterDayBlock, PosterLabels, PosterPayload } from './types';
import { buildRouteShareUrl } from './share-url';

const MAX_DISPLAY_DAYS = 4;
const MAX_POI_PER_DAY = 3;
const MAX_DESC_LEN = 48;

const DAY_THEME_COLORS = ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#1d3557', '#457b9d'];

function truncateText(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function buildDayBlocks(days: RouteDayPlan[], locale: LocaleCode, labels: PosterLabels): PosterDayBlock[] {
  const visibleDays = days.slice(0, MAX_DISPLAY_DAYS);
  return visibleDays.map((day, index) => {
    const dayNo = index + 1;
    const label =
      day.title?.trim() ||
      (locale === 'en-US' ? `${labels.dayPrefix} ${dayNo}` : `第 ${dayNo} 天`);
    const items = (day.attractions ?? []).slice(0, MAX_POI_PER_DAY).map((spot) => ({
      time: spot.time?.trim() || undefined,
      name: spot.name?.trim() || '—',
      desc: truncateText(spot.description ?? '', MAX_DESC_LEN),
      poiType: spot.poiType,
    }));
    return {
      label,
      themeColor: DAY_THEME_COLORS[index % DAY_THEME_COLORS.length]!,
      items,
    };
  });
}

function buildLabels(locale: LocaleCode, dayCount: number): PosterLabels {
  if (locale === 'en-US') {
    return {
      dayCount: dayCount === 1 ? '1 day' : `${dayCount} days`,
      moreDays: '+{count} more days',
      dayPrefix: 'Day',
    };
  }
  return {
    dayCount: `${dayCount} 天`,
    moreDays: '还有 {count} 天',
    dayPrefix: '第',
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

/** 从路线详情抽取统一 PosterPayload */
export function buildPosterPayload(input: BuildPosterPayloadInput): PosterPayload | null {
  const detail = input.route.routeDetail as RouteDetailPayload | null;
  const days = detail?.days ?? [];
  if (days.length === 0) return null;

  const city = detail?.matchedCity?.trim() || input.route.budgetRange?.trim() || '—';
  const dayCount = input.route.days || days.length;
  const labels = buildLabels(input.locale, dayCount);
  const hiddenDayCount = Math.max(0, days.length - MAX_DISPLAY_DAYS);

  return {
    routeId: input.route.id,
    city,
    title: input.route.name?.trim() || '—',
    subtitle: input.subtitle?.trim() || truncateText(input.route.description ?? '', 64),
    dayCount,
    days: buildDayBlocks(days, input.locale, labels),
    hiddenDayCount,
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
