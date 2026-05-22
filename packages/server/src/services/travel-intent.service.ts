import type { PlanChatMessage, TravelIntentSnapshot } from '@douxing/shared';
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
  };
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
  };
  intent.confidence = computeConfidence(intent);
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
  return intent;
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
  const parts: string[] = [];
  if (intent.city) parts.push(intent.city);
  if (intent.days != null) parts.push(`${intent.days}天`);
  if (intent.budget) parts.push(`预算${intent.budget}`);
  if (intent.themes.length > 0) parts.push(intent.themes.join('·'));
  return parts.length > 0 ? parts.join(' · ') : '通用休闲游';
}

export function formatIntentConstraintsForLlm(intent: TravelIntentSnapshot): string {
  const lines: string[] = ['【用户约束 — 必须严格遵守】'];
  if (intent.city) lines.push(`- 目的地城市：${intent.city}`);
  if (intent.days != null) lines.push(`- 行程天数：${intent.days} 天（routeDetail.days 长度必须等于 ${intent.days}）`);
  if (intent.budget) {
    if (intent.budgetMin != null && intent.budgetMax != null) {
      lines.push(`- 预算范围：${intent.budgetMin}-${intent.budgetMax} 元，budgetRange 字段填 "${intent.budgetMin}-${intent.budgetMax}"`);
    } else {
      lines.push(`- 预算：${intent.budget}`);
    }
  }
  if (intent.themes.length > 0) {
    lines.push(`- 主题偏好：${intent.themes.join('、')}，interestTags 须包含这些标签`);
  }
  if (lines.length === 1) return '';
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

  if (intent.city && !next.matchedCity.includes(intent.city)) {
    next.matchedCity = intent.city;
    if (!next.name.includes(intent.city)) {
      next.name = `${intent.city}${next.name}`;
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
          title: `${intent.city ?? '当地'}自由探索`,
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
    next.budgetRange = normalizeBudgetRange(intent, next.budgetRange);
  }

  if (intent.themes.length > 0) {
    next.interestTags = uniqueThemes([...intent.themes, ...next.interestTags]);
  }

  return next;
}
