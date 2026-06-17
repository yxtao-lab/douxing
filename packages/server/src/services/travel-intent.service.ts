import type {
  LodgingTier,
  PlanChatMessage,
  TransportPreference,
  TravelIntentSnapshot,
} from '@douxing/shared';
import { PROVINCE_CITY_REGIONS, findCityRegionByCode, findProvinceCodeByCityName, getCityNamesByProvinceCode } from '@douxing/shared';
import { CITY_CODE_MAP } from '../data/city-codes.js';
import type { GeneratedRouteDraft } from './route-generator.service.js';

const KNOWN_CITIES = Object.keys(CITY_CODE_MAP);

const CN_DAY_NUM: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
};

const TRANSPORT_KEYWORDS: Array<{ pattern: RegExp; value: TransportPreference }> = [
  { pattern: /高铁|动车|火车|铁路/, value: 'high_speed_rail' },
  { pattern: /飞机|航班|坐飞机|航空/, value: 'flight' },
  { pattern: /自驾|开车|租车/, value: 'self_drive' },
  { pattern: /大巴|巴士/, value: 'train' },
];

const LODGING_AREA_PATTERNS = [
  /住(?:在)?([\u4e00-\u9fa5]{2,8}(?:边|附近|商圈|景区|周围))/,
  /(?:靠近|临近)([\u4e00-\u9fa5]{2,8})/,
  /([\u4e00-\u9fa5]{2,6})附近(?:住|酒店)/,
];

const LODGING_TIER_KEYWORDS: Array<{ pattern: RegExp; value: LodgingTier }> = [
  { pattern: /经济型|快捷|青旅|民宿|穷游住/, value: 'budget' },
  { pattern: /豪华|奢华|五星|高星|精品酒店/, value: 'luxury' },
  { pattern: /舒适|四星|中档/, value: 'comfort' },
];

function detectTransportPreference(text: string): TransportPreference | null {
  for (const { pattern, value } of TRANSPORT_KEYWORDS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

function detectLodgingArea(text: string): string | null {
  for (const pattern of LODGING_AREA_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function detectLodgingTier(text: string): LodgingTier | null {
  for (const { pattern, value } of LODGING_TIER_KEYWORDS) {
    if (pattern.test(text)) return value;
  }
  return null;
}

function detectMultiCities(text: string): string[] {
  const found: string[] = [];
  for (const city of KNOWN_CITIES) {
    if (text.includes(city) && !found.includes(city)) {
      found.push(city);
    }
  }
  return found;
}

function mergeTransportPreference(
  current: TransportPreference | null | undefined,
  next: TransportPreference | null,
): TransportPreference | null {
  if (next) return next;
  return current ?? null;
}

function mergeLodgingTier(
  current: LodgingTier | null | undefined,
  next: LodgingTier | null,
): LodgingTier | null {
  if (next && next !== 'any') return next;
  return current ?? null;
}
const THEME_KEYWORDS: Record<string, string> = {
  亲子: '亲子',
  带娃: '亲子',
  儿童: '亲子',
  情侣: '浪漫',
  浪漫: '浪漫',
  蜜月: '浪漫',
  美食: '美食',
  吃货: '美食',
  文化: '文化',
  历史: '文化',
  博物馆: '文化',
  户外: '户外',
  徒步: '户外',
  摄影: '摄影',
  拍照: '摄影',
  穷游: '经济',
  经济: '经济',
  豪华: '奢华',
  奢华: '奢华',
  休闲: '休闲',
  放松: '休闲',
  冒险: '户外',
  自然: '自然',
  山水: '自然',
  购物: '购物',
  夜景: '夜景',
  独自: '独自',
  一个人: '独自',
  商务: '商务',
};

const BUDGET_TIER: Record<string, { min: number; max: number; label: string }> = {
  穷游: { min: 500, max: 2000, label: '500-2000' },
  经济: { min: 1500, max: 3500, label: '1500-3500' },
  舒适: { min: 3000, max: 8000, label: '3000-8000' },
  豪华: { min: 8000, max: 20000, label: '8000-20000' },
  奢华: { min: 10000, max: 30000, label: '10000-30000' },
};

function clampDays(value: number): number {
  return Math.min(Math.max(Math.round(value), 1), 7);
}

function uniqueThemes(themes: string[]): string[] {
  return [...new Set(themes.filter(Boolean))];
}

function detectCity(text: string): string | null {
  for (const city of KNOWN_CITIES) {
    if (text.includes(city)) return city;
  }
  const citySuffix = text.match(/([\u4e00-\u9fa5]{2,6})市/);
  if (citySuffix?.[1]) {
    const name = citySuffix[1];
    if (KNOWN_CITIES.includes(name)) return name;
  }
  return null;
}

/** 当前句是否明确指定了游玩目的地（非主题/偏好补充） */
export function hasExplicitDestinationInPrompt(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (detectCity(trimmed)) return true;
  const goMatch = trimmed.match(/想?去([\u4e00-\u9fa5]{2,4})(?:玩|游|看看|打卡|逛|待)/);
  if (goMatch?.[1] && detectCity(goMatch[1])) return true;
  if (/目的地|游玩城市|目的地是/.test(trimmed)) return true;
  return false;
}

function hasDepartureInPrompt(text: string): boolean {
  return detectDepartureCity(text) != null;
}

function hasExcludeProvinceInPrompt(text: string): boolean {
  return detectExcludeProvinceCodes(text).length > 0;
}

function parseDaysFromText(text: string): number | null {
  const digitMatch = text.match(/(\d+)\s*天/);
  if (digitMatch) return clampDays(parseInt(digitMatch[1], 10));

  const cnMatch = text.match(/([一两二三四五六七])\s*天/);
  if (cnMatch) {
    const n = CN_DAY_NUM[cnMatch[1]];
    if (n) return clampDays(n);
  }

  const tourMatch = text.match(/([一两二三四五六七])日?游/);
  if (tourMatch) {
    const n = CN_DAY_NUM[tourMatch[1]];
    if (n) return clampDays(n);
  }

  if (/周末/.test(text)) return 2;
  if (/小长假|清明|五一|国庆/.test(text) && /(\d+)\s*天/.test(text) === false) return 3;

  return null;
}

function parseBudgetNumbers(text: string): { min: number | null; max: number | null; label: string | null } {
  const rangeMatch = text.match(/(\d{3,6})\s*[-~到至]\s*(\d{3,6})/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return { min, max, label: `${min}-${max}` };
  }

  const aroundMatch = text.match(/(?:预算|大约|大概|左右)?\s*(\d{3,6})\s*(?:左右|以内|上下|元)?/);
  if (aroundMatch) {
    const value = parseInt(aroundMatch[1], 10);
    const min = Math.round(value * 0.85);
    const max = Math.round(value * 1.15);
    return { min, max, label: String(value) };
  }

  for (const [keyword, tier] of Object.entries(BUDGET_TIER)) {
    if (text.includes(keyword)) {
      return { min: tier.min, max: tier.max, label: tier.label };
    }
  }

  return { min: null, max: null, label: null };
}

function detectThemes(text: string): string[] {
  const themes: string[] = [];
  for (const [keyword, tag] of Object.entries(THEME_KEYWORDS)) {
    if (text.includes(keyword)) themes.push(tag);
  }
  return uniqueThemes(themes);
}

function isModificationText(text: string): boolean {
  return /(改成|改为|换成|调整?为|降到|提高到|增加|缩短|延长|不要|去掉|加点|加上|预算|天数|天$)/.test(text);
}

function parseModification(text: string): {
  city?: string;
  days?: number;
  dayDelta?: number;
  budget?: string;
  budgetMin?: number | null;
  budgetMax?: number | null;
  themes?: string[];
  removeThemes?: string[];
} {
  const patch: ReturnType<typeof parseModification> = {};

  const cityReplace = text.match(/(?:换成|改为|改成|去)\s*([\u4e00-\u9fa5]{2,6})/);
  if (cityReplace?.[1]) {
    const city = detectCity(cityReplace[1]) ?? detectCity(`${cityReplace[1]}市`);
    if (city) patch.city = city;
  } else {
    const city = detectCity(text);
    if (city && /(换成|改为|改成|去)/.test(text)) patch.city = city;
  }

  const dayAdjust = text.match(/(?:改成|改为|调整?为|缩短?到|延长?到|降到|提高到)?\s*(\d+)\s*天/);
  if (dayAdjust) {
    patch.days = clampDays(parseInt(dayAdjust[1], 10));
  } else if (/增加\s*一\s*天|多\s*一\s*天|加\s*一\s*天/.test(text)) {
    patch.dayDelta = 1;
  } else if (/减少\s*一\s*天|少\s*一\s*天|缩短\s*一\s*天/.test(text)) {
    patch.dayDelta = -1;
  } else {
    const days = parseDaysFromText(text);
    if (days != null && isModificationText(text)) patch.days = days;
  }

  const budget = parseBudgetNumbers(text);
  if (budget.label && /(预算|降到|提高到|改成|改为)/.test(text)) {
    patch.budget = budget.label;
    patch.budgetMin = budget.min;
    patch.budgetMax = budget.max;
  }

  const themes = detectThemes(text);
  if (themes.length > 0) {
    if (/(不要|去掉|取消)/.test(text)) {
      patch.removeThemes = themes;
    } else if (/(加点|加上|增加)/.test(text) || themes.length > 0) {
      patch.themes = themes;
    }
  }

  return patch;
}

function computeConfidence(intent: TravelIntentSnapshot): TravelIntentSnapshot['confidence'] {
  let score = 0;
  if (intent.city) score += 1;
  if (intent.days != null) score += 1;
  if (intent.budget) score += 1;
  if (intent.themes.length > 0) score += 1;
  if (score >= 3) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

export function createEmptyIntent(): TravelIntentSnapshot {
  return {
    city: null,
    days: null,
    budget: null,
    budgetMin: null,
    budgetMax: null,
    themes: [],
    confidence: 'low',
    transportPreference: null,
    lodgingArea: null,
    lodgingTier: null,
    cities: [],
    departureCity: null,
    excludeProvinceCodes: [],
    suggestedDestinations: [],
    constraintSummary: null,
    intentSource: 'rule',
  };
}

/** 用于 RAG / 玩法检索的实际游玩目的地 */
export function resolvePlanningCity(intent: TravelIntentSnapshot): string | null {
  if (intent.city && intent.departureCity && intent.city === intent.departureCity) {
    const alt = intent.suggestedDestinations?.find((item) => item !== intent.departureCity);
    if (alt) return alt;
    return null;
  }
  if (intent.city) return intent.city;
  if (intent.suggestedDestinations?.length) return intent.suggestedDestinations[0] ?? null;
  if (intent.cities?.length) return intent.cities[0] ?? null;
  return null;
}

function resolveProvinceCodeForCityName(cityName: string): string | undefined {
  const normalized = cityName.trim().replace(/市$/, '').replace(/土家族苗族自治州$/, '');
  if (!normalized) return undefined;
  const fromRegions = findProvinceCodeByCityName(normalized);
  if (fromRegions) return fromRegions;
  const cityCode = CITY_CODE_MAP[normalized];
  if (cityCode) {
    return findCityRegionByCode(cityCode)?.provinceCode;
  }
  return undefined;
}

function formatExcludedProvinceCityHints(excludeProvinceCodes: string[]): string {
  const names = excludeProvinceCodes.flatMap((code) => getCityNamesByProvinceCode(code));
  if (names.length === 0) return '';
  return names.join('、');
}

/** 校验 LLM 返回的 matchedCity 是否违反区域排除 */
export function assertMatchedCityAllowed(intent: TravelIntentSnapshot, matchedCity: string): void {
  const safeIntent = sanitizeTravelIntentDestinations(intent);
  const exclude = safeIntent.excludeProvinceCodes ?? [];
  if (exclude.length === 0 || !matchedCity.trim()) return;
  if (isCityInExcludedProvinces(matchedCity, exclude)) {
    const excludeLabel = formatExcludeProvinces(safeIntent);
    const examples = formatExcludedProvinceCityHints(exclude);
    throw new Error(
      `生成路线 matchedCity=${matchedCity} 位于用户排除的${excludeLabel}境内`
        + (examples ? `（含 ${examples} 等，禁止推荐）` : ''),
    );
  }
}

function detectExcludeProvinceCodes(text: string): string[] {
  const codes: string[] = [];
  for (const province of PROVINCE_CITY_REGIONS) {
    const name = province.nameZh;
    if (
      new RegExp(`不在${name}(?:省|境内|玩|游)?`).test(text)
      || new RegExp(`不出${name}(?:省|境内)?`).test(text)
      || new RegExp(`别在${name}(?:省|境内)?`).test(text)
      || new RegExp(`不去${name}(?:省|境内)?`).test(text)
      || new RegExp(`排除${name}(?:省)?`).test(text)
    ) {
      codes.push(province.code);
    }
  }
  return codes;
}

function detectDepartureCity(text: string): string | null {
  const patterns = [
    /从([\u4e00-\u9fa5]{2,6})出发/,
    /([\u4e00-\u9fa5]{2,6})出发/,
    /在([\u4e00-\u9fa5]{2,6})(?:上车|启程)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const city = detectCity(match[1]) ?? detectCity(`${match[1]}市`);
      if (city) return city;
    }
  }
  return null;
}

export function isCityInExcludedProvinces(cityName: string, excludeProvinceCodes: string[]): boolean {
  if (!cityName.trim() || excludeProvinceCodes.length === 0) return false;
  const provinceCode = resolveProvinceCodeForCityName(cityName);
  return provinceCode != null && excludeProvinceCodes.includes(provinceCode);
}

/**
 * 剔除落在 excludeProvinceCodes 内的目的地；区域排除优先于 LLM 误推荐的目的地。
 */
export function sanitizeTravelIntentDestinations(intent: TravelIntentSnapshot): TravelIntentSnapshot {
  const exclude = intent.excludeProvinceCodes ?? [];
  if (exclude.length === 0) return intent;

  let city = intent.city;
  if (city && isCityInExcludedProvinces(city, exclude)) {
    city = null;
  }

  const suggestedDestinations = (intent.suggestedDestinations ?? []).filter(
    (item) => !isCityInExcludedProvinces(item, exclude),
  );
  const cities = (intent.cities ?? []).filter((item) => !isCityInExcludedProvinces(item, exclude));

  if (
    city === intent.city
    && suggestedDestinations.length === (intent.suggestedDestinations?.length ?? 0)
    && cities.length === (intent.cities?.length ?? 0)
  ) {
    return intent;
  }

  return { ...intent, city, suggestedDestinations, cities };
}

/**
 * 追问时合并会话 intentSnapshot：硬约束以 session 为权威，剔除 LLM 臆造且与排除冲突的目的地。
 */
export function mergeSessionIntentSnapshot(
  sessionIntent: TravelIntentSnapshot | null | undefined,
  parsedIntent: TravelIntentSnapshot,
  currentPrompt?: string,
): TravelIntentSnapshot {
  if (!sessionIntent) {
    return sanitizeTravelIntentDestinations(parsedIntent);
  }

  const trimmedPrompt = currentPrompt?.trim() ?? '';
  const explicitDestInPrompt = trimmedPrompt ? hasExplicitDestinationInPrompt(trimmedPrompt) : false;

  const excludeProvinceCodes = [
    ...new Set([
      ...(sessionIntent.excludeProvinceCodes ?? []),
      ...(parsedIntent.excludeProvinceCodes ?? []),
    ]),
  ];

  const validSessionCity =
    sessionIntent.city && !isCityInExcludedProvinces(sessionIntent.city, excludeProvinceCodes)
      ? sessionIntent.city
      : null;

  let city = parsedIntent.city;
  if (city && isCityInExcludedProvinces(city, excludeProvinceCodes)) {
    city = validSessionCity;
  } else if (trimmedPrompt && !explicitDestInPrompt && city) {
    // 追问仅补充主题/偏好时，不采纳 LLM 在本轮臆造的目的地
    city = validSessionCity;
  } else if (!city) {
    city = validSessionCity;
  }

  const departureCity = trimmedPrompt && hasDepartureInPrompt(trimmedPrompt)
    ? (parsedIntent.departureCity ?? sessionIntent.departureCity)
    : (sessionIntent.departureCity ?? parsedIntent.departureCity);

  const merged: TravelIntentSnapshot = {
    ...parsedIntent,
    city,
    excludeProvinceCodes,
    departureCity,
    days: parsedIntent.days ?? sessionIntent.days,
    budget: parsedIntent.budget ?? sessionIntent.budget,
    budgetMin: parsedIntent.budgetMin ?? sessionIntent.budgetMin,
    budgetMax: parsedIntent.budgetMax ?? sessionIntent.budgetMax,
    transportPreference: parsedIntent.transportPreference ?? sessionIntent.transportPreference,
    lodgingArea: parsedIntent.lodgingArea ?? sessionIntent.lodgingArea,
    lodgingTier: parsedIntent.lodgingTier ?? sessionIntent.lodgingTier,
    themes: uniqueThemes([...(sessionIntent.themes ?? []), ...(parsedIntent.themes ?? [])]),
    cities:
      explicitDestInPrompt && parsedIntent.cities && parsedIntent.cities.length > 0
        ? parsedIntent.cities
        : sessionIntent.cities,
    suggestedDestinations: [
      ...new Set([
        ...(sessionIntent.suggestedDestinations ?? []),
        ...(parsedIntent.suggestedDestinations ?? []),
      ]),
    ],
    constraintSummary:
      trimmedPrompt && (explicitDestInPrompt || hasExcludeProvinceInPrompt(trimmedPrompt))
        ? (parsedIntent.constraintSummary ?? sessionIntent.constraintSummary)
        : (sessionIntent.constraintSummary ?? parsedIntent.constraintSummary),
    confidence: parsedIntent.confidence ?? sessionIntent.confidence,
    intentSource: parsedIntent.intentSource ?? sessionIntent.intentSource,
  };

  return sanitizeTravelIntentDestinations(merged);
}

/** 生成/落库前统一清洗意图，确保区域排除等硬约束生效 */
export function finalizePlanningIntent(intent: TravelIntentSnapshot): TravelIntentSnapshot {
  return sanitizeTravelIntentDestinations(intent);
}

function formatExcludeProvinces(intent: TravelIntentSnapshot): string {
  const codes = intent.excludeProvinceCodes ?? [];
  if (codes.length === 0) return '';
  const names = codes.map((code) => {
    const province = PROVINCE_CITY_REGIONS.find((item) => item.code === code);
    return province?.nameZh ?? code;
  });
  return names.join('、');
}

function applyH9Fields(intent: TravelIntentSnapshot, text: string): void {
  const transport = detectTransportPreference(text);
  intent.transportPreference = mergeTransportPreference(intent.transportPreference, transport);

  const area = detectLodgingArea(text);
  if (area) intent.lodgingArea = area;

  const tier = detectLodgingTier(text);
  intent.lodgingTier = mergeLodgingTier(intent.lodgingTier, tier);

  const multi = detectMultiCities(text);
  if (multi.length >= 2) {
    intent.cities = multi;
  } else if (intent.city && !intent.cities?.length) {
    intent.cities = [intent.city];
  }
}

/** 从单条自然语言中抽取旅行意图 */
export function parseTravelIntent(text: string): TravelIntentSnapshot {
  const trimmed = text.trim();
  const budget = parseBudgetNumbers(trimmed);
  const intent: TravelIntentSnapshot = {
    city: detectCity(trimmed),
    days: parseDaysFromText(trimmed),
    budget: budget.label,
    budgetMin: budget.min,
    budgetMax: budget.max,
    themes: detectThemes(trimmed),
    confidence: 'low',
    transportPreference: null,
    lodgingArea: null,
    lodgingTier: null,
    cities: [],
  };
  intent.confidence = computeConfidence(intent);
  applyH9Fields(intent, trimmed);
  return intent;
}

/** 合并历史 user 文本与当前输入，得到完整意图 */
export function buildIntentFromConversation(
  messages: string[],
  explicit?: { days?: number; budget?: string },
): TravelIntentSnapshot {
  let intent = createEmptyIntent();

  for (const message of messages) {
    const trimmed = message.trim();
    if (!trimmed) continue;

    if (isModificationText(trimmed) && (intent.city || intent.days != null)) {
      const patch = parseModification(trimmed);

      if (patch.city) intent.city = patch.city;
      if (patch.days != null) intent.days = patch.days;
      if (patch.dayDelta != null && intent.days != null) {
        intent.days = clampDays(intent.days + patch.dayDelta);
      }
      if (patch.budget) {
        intent.budget = patch.budget;
        intent.budgetMin = patch.budgetMin ?? null;
        intent.budgetMax = patch.budgetMax ?? null;
      }
      if (patch.themes?.length) {
        intent.themes = uniqueThemes([...intent.themes, ...patch.themes]);
      }
      if (patch.removeThemes?.length) {
        intent.themes = intent.themes.filter((t) => !patch.removeThemes!.includes(t));
      }
    } else {
      const parsed = parseTravelIntent(trimmed);
      if (parsed.city) intent.city = parsed.city;
      if (parsed.days != null) intent.days = parsed.days;
      if (parsed.budget) {
        intent.budget = parsed.budget;
        intent.budgetMin = parsed.budgetMin;
        intent.budgetMax = parsed.budgetMax;
      }
      if (parsed.themes.length > 0) {
        intent.themes = uniqueThemes([...intent.themes, ...parsed.themes]);
      }
      if (parsed.transportPreference) {
        intent.transportPreference = mergeTransportPreference(
          intent.transportPreference,
          parsed.transportPreference,
        );
      }
      if (parsed.lodgingArea) intent.lodgingArea = parsed.lodgingArea;
      if (parsed.lodgingTier) {
        intent.lodgingTier = mergeLodgingTier(intent.lodgingTier, parsed.lodgingTier);
      }
      if (parsed.cities && parsed.cities.length >= 2) {
        intent.cities = parsed.cities;
      }
      const excludeCodes = detectExcludeProvinceCodes(trimmed);
      if (excludeCodes.length > 0) {
        intent.excludeProvinceCodes = [
          ...new Set([...(intent.excludeProvinceCodes ?? []), ...excludeCodes]),
        ];
      }
      const departure = detectDepartureCity(trimmed);
      if (departure) intent.departureCity = departure;
    }
  }

  if (explicit?.days != null) intent.days = clampDays(explicit.days);
  if (explicit?.budget?.trim()) {
    const budget = parseBudgetNumbers(explicit.budget);
    intent.budget = budget.label ?? explicit.budget.trim();
    intent.budgetMin = budget.min;
    intent.budgetMax = budget.max;
  }

  intent.confidence = computeConfidence(intent);
  const fullText = messages.join('；');
  applyH9Fields(intent, fullText);
  return sanitizeTravelIntentDestinations(intent);
}

export function buildIntentFromHistory(
  history: PlanChatMessage[] | undefined,
  currentPrompt: string,
  explicit?: { days?: number; budget?: string },
): TravelIntentSnapshot {
  const userMessages = (history ?? [])
    .filter((m) => m.role === 'user')
    .map((m) => m.content.trim())
    .filter(Boolean);
  return buildIntentFromConversation([...userMessages, currentPrompt.trim()], explicit);
}

export function formatIntentSummary(intent: TravelIntentSnapshot): string {
  if (intent.constraintSummary?.trim()) return intent.constraintSummary.trim();
  const parts: string[] = [];
  if (intent.departureCity) parts.push(`从${intent.departureCity}出发`);
  const planningCity = resolvePlanningCity(intent);
  if (planningCity) parts.push(planningCity);
  if (intent.days != null) parts.push(`${intent.days}天`);
  if (intent.budget) parts.push(`预算${intent.budget}`);
  if (intent.themes.length > 0) parts.push(intent.themes.join('·'));
  const excludeLabel = formatExcludeProvinces(intent);
  if (excludeLabel) parts.push(`不出${excludeLabel}`);
  if (intent.transportPreference && intent.transportPreference !== 'any') {
    parts.push(`交通:${intent.transportPreference}`);
  }
  if (intent.lodgingArea) parts.push(`住${intent.lodgingArea}`);
  return parts.length > 0 ? parts.join(' · ') : '通用休闲游';
}

export function formatIntentConstraintsForLlm(intent: TravelIntentSnapshot): string {
  const safeIntent = sanitizeTravelIntentDestinations(intent);
  const lines: string[] = ['【用户约束 — 必须严格遵守】'];
  if (safeIntent.departureCity) {
    lines.push(
      `- 出发城市：${safeIntent.departureCity}（仅作大交通起点，禁止在此安排游玩 POI）`,
    );
  }
  const planningCity = resolvePlanningCity(safeIntent);
  if (planningCity) {
    lines.push(`- 目的地城市：${planningCity}（matchedCity 须为此城市）`);
  } else if (safeIntent.suggestedDestinations?.length) {
    lines.push(
      `- 目的地：从下列候选中选择其一作为主目的地：${safeIntent.suggestedDestinations.join('、')}`,
    );
  }
  const excludeLabel = formatExcludeProvinces(safeIntent);
  if (excludeLabel) {
    lines.push(`- 区域限制：所有游玩 POI 不得位于 ${excludeLabel} 境内`);
    const forbiddenCities = formatExcludedProvinceCityHints(safeIntent.excludeProvinceCodes ?? []);
    if (forbiddenCities) {
      lines.push(`- matchedCity 禁止为 ${excludeLabel} 境内城市（含 ${forbiddenCities} 等）`);
    }
  }
  if (!planningCity && !(safeIntent.suggestedDestinations?.length) && excludeLabel) {
    lines.push(`- 目的地：须在 ${excludeLabel} 以外选择，并结合主题偏好规划（禁止推荐该省境内城市）`);
  }
  if (intent.days != null) {
    lines.push(`- 行程天数：${intent.days} 天（routeDetail.days 长度必须等于 ${intent.days}）`);
  }
  if (intent.budget) {
    if (intent.budgetMin != null && intent.budgetMax != null) {
      lines.push(
        `- 预算范围：${intent.budgetMin}-${intent.budgetMax} 元，budgetRange 字段填 "${intent.budgetMin}-${intent.budgetMax}"`,
      );
    } else {
      lines.push(`- 预算：${intent.budget}`);
    }
  }
  if (intent.themes.length > 0) {
    lines.push(`- 主题偏好：${intent.themes.join('、')}，interestTags 须包含这些标签`);
  }
  if (intent.transportPreference && intent.transportPreference !== 'any') {
    const labelMap: Record<TransportPreference, string> = {
      train: '火车',
      flight: '飞机',
      high_speed_rail: '高铁',
      self_drive: '自驾',
      any: '不限',
    };
    lines.push(`- 交通方式：${labelMap[intent.transportPreference]}`);
  }
  if (intent.constraintSummary?.trim()) {
    lines.push(`- 需求摘要：${intent.constraintSummary.trim()}`);
  }
  lines.push('- 仅规划游玩 POI（attraction/restaurant/meal）；不要输出 hotel/transport 节点，交通与住宿由系统补全');
  if (lines.length === 1) return '';
  return lines.join('\n');
}

/** H9：Enricher 约束块（交通/住宿偏好） */
export function formatIntentConstraintsForEnricher(intent: TravelIntentSnapshot): string {
  const lines: string[] = ['【Enricher 约束 — 交通与住宿】'];
  let hasContent = false;

  if (intent.transportPreference && intent.transportPreference !== 'any') {
    const labelMap: Record<TransportPreference, string> = {
      train: '火车',
      flight: '飞机',
      high_speed_rail: '高铁',
      self_drive: '自驾',
      any: '不限',
    };
    lines.push(`- 大交通偏好：${labelMap[intent.transportPreference]}`);
    hasContent = true;
  }
  if (intent.lodgingArea) {
    lines.push(`- 住宿区域：${intent.lodgingArea}`);
    hasContent = true;
  }
  if (intent.lodgingTier && intent.lodgingTier !== 'any') {
    const tierMap: Record<LodgingTier, string> = {
      budget: '经济型',
      comfort: '舒适型',
      luxury: '豪华型',
      any: '不限',
    };
    lines.push(`- 住宿档次：${tierMap[intent.lodgingTier]}`);
    hasContent = true;
  }
  if (intent.cities && intent.cities.length >= 2) {
    lines.push(`- 多城顺序：${intent.cities.join(' → ')}`);
    hasContent = true;
  }

  if (!hasContent) return '';
  return lines.join('\n');
}

function normalizeBudgetRange(intent: TravelIntentSnapshot, current: string): string {
  if (intent.budgetMin != null && intent.budgetMax != null) {
    return `${intent.budgetMin}-${intent.budgetMax}`;
  }
  if (intent.budget) return intent.budget;
  return current;
}

/** 对生成结果做约束校正，确保符合解析出的意图 */
export function enforceRouteConstraints(
  draft: GeneratedRouteDraft,
  intent: TravelIntentSnapshot,
): GeneratedRouteDraft {
  const next = { ...draft, routeDetail: { days: [...draft.routeDetail.days] } };
  const safeIntent = sanitizeTravelIntentDestinations(intent);
  const planningCity = resolvePlanningCity(safeIntent);

  assertMatchedCityAllowed(safeIntent, next.matchedCity);

  if (planningCity && !next.matchedCity.includes(planningCity)) {
    next.matchedCity = planningCity;
    if (!next.name.includes(planningCity)) {
      next.name = `${planningCity}${next.name}`;
    }
  }

  if (intent.days != null) {
    next.days = intent.days;
    if (next.routeDetail.days.length > intent.days) {
      next.routeDetail.days = next.routeDetail.days.slice(0, intent.days);
    } else if (next.routeDetail.days.length < intent.days && next.routeDetail.days.length > 0) {
      const last = next.routeDetail.days[next.routeDetail.days.length - 1]!;
      while (next.routeDetail.days.length < intent.days) {
        const idx = next.routeDetail.days.length + 1;
        next.routeDetail.days.push({
          ...last,
          date: `第${idx}天`,
          title: `${planningCity ?? '当地'}自由探索`,
          attractions: last.attractions.map((a) => ({ ...a })),
        });
      }
    }
    next.routeDetail.days = next.routeDetail.days.map((day, i) => ({
      ...day,
      date: day.date || `第${i + 1}天`,
    }));
  }

  if (intent.budget || intent.budgetMin != null) {
    next.budgetRange = normalizeBudgetRange(safeIntent, next.budgetRange);
  }

  if (safeIntent.themes.length > 0) {
    next.interestTags = uniqueThemes([...safeIntent.themes, ...next.interestTags]);
  }

  return next;
}
