import { USER_INTEREST_PRESETS } from '../constants.js';
import type { LocaleCode } from './types.js';
import { DEFAULT_LOCALE } from './constants.js';

/** 兴趣标签存储值（中文，与 USER_INTEREST_PRESETS 一致） */
export type InterestTagValue = (typeof USER_INTEREST_PRESETS)[number];

export type InterestTagSlug =
  | 'culture'
  | 'nature'
  | 'food'
  | 'family'
  | 'entertainment'
  | 'urban'
  | 'shopping'
  | 'nightscape'
  | 'history'
  | 'leisure'
  | 'outdoor'
  | 'photography';

const TAG_TO_SLUG: Record<InterestTagValue, InterestTagSlug> = {
  文化: 'culture',
  自然: 'nature',
  美食: 'food',
  亲子: 'family',
  娱乐: 'entertainment',
  都市: 'urban',
  购物: 'shopping',
  夜景: 'nightscape',
  历史: 'history',
  休闲: 'leisure',
  户外: 'outdoor',
  摄影: 'photography',
};

const INTEREST_TAG_LABELS: Record<LocaleCode, Record<InterestTagSlug, string>> = {
  'zh-CN': {
    culture: '文化',
    nature: '自然',
    food: '美食',
    family: '亲子',
    entertainment: '娱乐',
    urban: '都市',
    shopping: '购物',
    nightscape: '夜景',
    history: '历史',
    leisure: '休闲',
    outdoor: '户外',
    photography: '摄影',
  },
  'en-US': {
    culture: 'Culture',
    nature: 'Nature',
    food: 'Food',
    family: 'Family',
    entertainment: 'Entertainment',
    urban: 'City',
    shopping: 'Shopping',
    nightscape: 'Night views',
    history: 'History',
    leisure: 'Leisure',
    outdoor: 'Outdoors',
    photography: 'Photography',
  },
};

export const interestTagPresets = [...USER_INTEREST_PRESETS] as InterestTagValue[];

/** 单枚兴趣标签的展示文案（存储值仍为中文） */
export function formatInterestTagLabel(tag: string, locale: LocaleCode = DEFAULT_LOCALE): string {
  const slug = TAG_TO_SLUG[tag as InterestTagValue];
  if (!slug) return tag;
  const table = INTEREST_TAG_LABELS[locale] ?? INTEREST_TAG_LABELS[DEFAULT_LOCALE];
  return table[slug] ?? tag;
}

/** 多枚兴趣标签拼接（随语言切换分隔符） */
export function joinInterestTagLabels(
  tags: string[] | null | undefined,
  locale: LocaleCode = DEFAULT_LOCALE,
): string {
  const list = tags ?? [];
  if (list.length === 0) return '';
  const separator = locale === 'en-US' ? ', ' : '、';
  return list.map((tag) => formatInterestTagLabel(tag, locale)).join(separator);
}

export function getInterestTagSlug(tag: string): InterestTagSlug | undefined {
  return TAG_TO_SLUG[tag as InterestTagValue];
}
