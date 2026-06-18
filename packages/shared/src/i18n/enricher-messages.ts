import type { LocaleCode } from './types.js';
import type { PlaybookTransitReasonKey } from '../types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';
import { formatMinutesAsTime } from '../open-hours.js';

const ENRICHER_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'enricher.warn.lateSchedule': '{name} 排程偏晚，建议调整',
    'enricher.warn.noCoords': '{name} 无坐标，未参与路径优化',
    'enricher.warn.closedDay': '{name} 当日闭馆，请调整行程',
    'enricher.warn.beforeOpen':
      '{name} 到达时间早于开放（{openTime} 起），建议 {openTime} 后再前往',
    'enricher.warn.afterClose':
      '{name} 游玩结束晚于闭馆（{closeTime}），建议缩短停留或改期',
    'enricher.warn.playbookOrderAdjusted':
      '已按{scope}经典动线调整游览顺序',
    'enricher.intercity.catalog': '参考班次 {scheduleNo}，可跳转第三方订票',
    'enricher.intercity.api': '班次 {scheduleNo}（实时查询），可跳转订票',
    'enricher.intercity.template': '参考耗时；演示订票链接',
    'enricher.transit.classicWalk': '经典动线建议步行（{scope}）',
    'enricher.transit.scenicWalk': '景区内建议步行（{scope}）',
    'enricher.transit.sightseeingBus': '景区建议观光车（{scope}）',
    'enricher.transit.ferry': '建议游船（{scope}）',
    'enricher.transit.taxiShort': '短距建议打车（{scope}）',
  },
  'en-US': {
    'enricher.warn.lateSchedule': 'Tight schedule at {name}',
    'enricher.warn.noCoords': '{name} has no coordinates; order not optimized',
    'enricher.warn.closedDay': '{name} is closed on this day; adjust your plan',
    'enricher.warn.beforeOpen':
      '{name}: arrival is before opening ({openTime}); visit after {openTime}',
    'enricher.warn.afterClose':
      '{name}: visit ends after closing ({closeTime}); shorten stay or reschedule',
    'enricher.warn.playbookOrderAdjusted':
      'Visit order adjusted to match the classic route ({scope})',
    'enricher.intercity.catalog': 'Ref. {scheduleNo} — book via partner link',
    'enricher.intercity.api': '{scheduleNo} (live) — book via partner link',
    'enricher.intercity.template': 'Reference duration only; demo booking link',
    'enricher.transit.classicWalk': 'Classic route: walk ({scope})',
    'enricher.transit.scenicWalk': 'Walk inside scenic area ({scope})',
    'enricher.transit.sightseeingBus': 'Scenic shuttle suggested ({scope})',
    'enricher.transit.ferry': 'Ferry suggested ({scope})',
    'enricher.transit.taxiShort': 'Short taxi hop ({scope})',
  },
};

function enricherMsg(
  key: string,
  locale: LocaleCode,
  params?: Record<string, string | number>,
): string {
  const table = ENRICHER_MESSAGES[locale] ?? ENRICHER_MESSAGES[DEFAULT_LOCALE];
  const fallback = ENRICHER_MESSAGES[DEFAULT_LOCALE];
  return formatMessage(table[key] ?? fallback[key] ?? key, params);
}

export type EnricherWarningKey =
  | 'lateSchedule'
  | 'noCoords'
  | 'closedDay'
  | 'beforeOpen'
  | 'afterClose'
  | 'playbookOrderAdjusted';

export function formatEnricherWarning(
  key: EnricherWarningKey,
  locale: LocaleCode,
  params: {
    name: string;
    scope?: string;
    openMinutes?: number;
    closeMinutes?: number;
  },
): string {
  const messageKey = `enricher.warn.${key}`;
  const openTime =
    params.openMinutes != null ? formatMinutesAsTime(params.openMinutes) : '';
  const closeTime =
    params.closeMinutes != null ? formatMinutesAsTime(params.closeMinutes) : '';
  return enricherMsg(messageKey, locale, {
    name: params.name,
    scope: params.scope ?? params.name,
    openTime,
    closeTime,
  });
}

export type IntercityDescriptionKey = 'catalog' | 'api' | 'template';

/** H9-3：跨城段说明文案 */
export function formatIntercitySegmentDescription(
  key: IntercityDescriptionKey,
  locale: LocaleCode,
  params?: { scheduleNo?: string },
): string {
  const messageKey = `enricher.intercity.${key}`;
  return enricherMsg(messageKey, locale, {
    scheduleNo: params?.scheduleNo?.trim() ?? '',
  });
}

/** H9-4：玩法段间交通推荐理由 */
export function formatPlaybookTransitDescription(
  reasonKey: PlaybookTransitReasonKey,
  locale: LocaleCode,
  params: { scope: string },
): string {
  return enricherMsg(`enricher.transit.${reasonKey}`, locale, {
    scope: params.scope,
  });
}
