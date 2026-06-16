import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';
import { formatMessage } from './format-message.js';

const VALIDATOR_MESSAGES: Record<LocaleCode, Record<string, string>> = {
  'zh-CN': {
    'validator.warn.duplicatePoi': '景点「{name}」在行程中重复出现',
    'validator.warn.poiNotInLibrary': '景点「{name}」不在内容库，建议替换',
    'validator.warn.lodgingFallback': '住宿「{name}」为系统占位推荐，待确认',
    'validator.warn.lodgingUnverified': '住宿「{name}」来自地图检索，价格待核实',
    'validator.warn.transitEstimated': '「{from}→{to}」交通班次为估算',
    'validator.warn.wideGeoSpan': '「{title}」当日景点跨区较大，注意交通时间',
  },
  'en-US': {
    'validator.warn.duplicatePoi': 'POI "{name}" appears more than once',
    'validator.warn.poiNotInLibrary': '"{name}" is not in the content library',
    'validator.warn.lodgingFallback': 'Stay "{name}" is a placeholder — confirm before booking',
    'validator.warn.lodgingUnverified': 'Stay "{name}" from map search — verify price',
    'validator.warn.transitEstimated': '{from} → {to}: schedule is estimated',
    'validator.warn.wideGeoSpan': '"{title}" spans a wide area — allow travel time',
  },
};

export type ValidatorWarningKey =
  | 'duplicatePoi'
  | 'poiNotInLibrary'
  | 'lodgingFallback'
  | 'lodgingUnverified'
  | 'transitEstimated'
  | 'wideGeoSpan';

export function formatValidatorWarning(
  key: ValidatorWarningKey,
  locale: LocaleCode,
  params: Record<string, string>,
): string {
  const table = VALIDATOR_MESSAGES[locale] ?? VALIDATOR_MESSAGES[DEFAULT_LOCALE];
  const fallback = VALIDATOR_MESSAGES[DEFAULT_LOCALE];
  const messageKey = `validator.warn.${key}`;
  return formatMessage(table[messageKey] ?? fallback[messageKey] ?? messageKey, params);
}
