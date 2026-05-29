import type { LocaleCode } from './types.js';
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
  },
  'en-US': {
    'enricher.warn.lateSchedule': 'Tight schedule at {name}',
    'enricher.warn.noCoords': '{name} has no coordinates; order not optimized',
    'enricher.warn.closedDay': '{name} is closed on this day; adjust your plan',
    'enricher.warn.beforeOpen':
      '{name}: arrival is before opening ({openTime}); visit after {openTime}',
    'enricher.warn.afterClose':
      '{name}: visit ends after closing ({closeTime}); shorten stay or reschedule',
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
  | 'afterClose';

export function formatEnricherWarning(
  key: EnricherWarningKey,
  locale: LocaleCode,
  params: {
    name: string;
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
    openTime,
    closeTime,
  });
}
