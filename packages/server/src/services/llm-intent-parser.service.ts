/**
 * C2+：LLM 结构化旅行意图解析
 * 优先理解出发地/目的地/区域排除等复杂约束，失败时由规则解析兜底。
 */
import { z } from 'zod';
import type { PlanChatMessage, TravelIntentSnapshot } from '@douxing/shared';
import { PROVINCE_CITY_REGIONS } from '@douxing/shared';
import { CITY_CODE_MAP } from '../data/city-codes.js';
import { isLlmIntentParseEnabled } from '../config/llm.js';
import { chatCompletionForJson } from './llm-client.service.js';
import { buildIntentFromHistory, finalizePlanningIntent, mergeSessionIntentSnapshot, sanitizeTravelIntentDestinations } from './travel-intent.service.js';

const KNOWN_CITIES = Object.keys(CITY_CODE_MAP);
const KNOWN_PROVINCE_CODES = PROVINCE_CITY_REGIONS.map((p) => p.code);
const PROVINCE_NAME_TO_CODE: Record<string, string> = {};
for (const province of PROVINCE_CITY_REGIONS) {
  PROVINCE_NAME_TO_CODE[province.nameZh] = province.code;
  PROVINCE_NAME_TO_CODE[province.nameEn.toLowerCase()] = province.code;
  PROVINCE_NAME_TO_CODE[province.code] = province.code;
}

const ALLOWED_THEMES = [
  '亲子',
  '浪漫',
  '美食',
  '文化',
  '户外',
  '摄影',
  '经济',
  '奢华',
  '休闲',
  '自然',
  '购物',
  '夜景',
  '独自',
  '商务',
] as const;

const llmIntentRawSchema = z.object({
  departureCity: z.string().nullable().optional(),
  destinationCity: z.string().nullable().optional(),
  suggestedDestinations: z.array(z.string()).optional(),
  excludeProvinceCodes: z.array(z.string()).optional(),
  days: z.number().int().min(1).max(7).nullable().optional(),
  budgetMin: z.number().nullable().optional(),
  budgetMax: z.number().nullable().optional(),
  budget: z.string().nullable().optional(),
  themes: z.array(z.string()).optional(),
  transportPreference: z
    .enum(['train', 'flight', 'high_speed_rail', 'self_drive', 'any'])
    .nullable()
    .optional(),
  lodgingArea: z.string().nullable().optional(),
  lodgingTier: z.enum(['budget', 'comfort', 'luxury', 'any']).nullable().optional(),
  cities: z.array(z.string()).optional(),
  startDate: z.string().nullable().optional(),
  constraintSummary: z.string().nullable().optional(),
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

const INTENT_PARSE_SYSTEM_PROMPT = `你是兜行（Douxing）旅行意图解析器。从用户对话中提取结构化规划约束。
必须只输出一个 JSON 对象，不要 markdown 代码块，不要其他说明文字。

JSON 字段说明：
{
  "departureCity": "出发/起点城市，如「武汉出发」中的武汉；无则 null",
  "destinationCity": "游玩目的地城市；用户未指定则 null",
  "suggestedDestinations": ["用户未指定目的地时，给出2-3个符合约束的候选城市"],
  "excludeProvinceCodes": ["排除省份 code，如 hubei、hunan；与 city-regions 对齐"],
  "days": 1-7 整数或 null,
  "budgetMin": 数字或 null,
  "budgetMax": 数字或 null,
  "budget": "如 1000-2000 或 null",
  "themes": ["从预设中选：亲子、浪漫、美食、文化、户外、摄影、经济、奢华、休闲、自然、购物、夜景、独自、商务"],
  "transportPreference": "train|flight|high_speed_rail|self_drive|any 或 null",
  "lodgingArea": "住宿区域偏好或 null",
  "lodgingTier": "budget|comfort|luxury|any 或 null",
  "cities": ["多城顺序，如 成都, 乐山"],
  "startDate": "YYYY-MM-DD 或 null",
  "constraintSummary": "一句话中文摘要用户核心诉求",
  "confidence": "low|medium|high"
}

关键规则：
1. 「XX出发/从XX出发/在XX上车」→ departureCity=XX，不要把出发地当 destinationCity。
2. 「去XX/目的地XX/玩XX」→ destinationCity=XX（须不在 excludeProvinceCodes 对应省份内）。
3. 「不在XX省/不出XX省/别在XX省内」→ excludeProvinceCodes 填入对应省份 code（湖北=hubei）；追问时必须继承历史中已明确的 excludeProvinceCodes，不得丢失。
4. 「不在XX玩/别在XX安排景点」若 XX 是城市名 → 不要写入 excludeProvinceCodes；出发地禁游由 departureCity 表达。
5. 仅补充主题/偏好（如「去看山水」「想滑雪」「加点美食」）→ 更新 themes，不要擅自把 destinationCity 设为与 excludeProvinceCodes 冲突的城市（如排除湖北时禁止推荐宜昌/武汉）。
6. destinationCity 与 suggestedDestinations 中每个城市，其所在省份均不得出现在 excludeProvinceCodes。
7. 若只有出发地、无目的地，destinationCity=null，在 suggestedDestinations 推荐符合天数/预算/交通/排除约束的目的地。
8. 不要臆造用户未提及的信息；不确定的字段填 null 或 []。
9. 城市名使用中文简称（武汉、杭州、宜昌，不带「市」）。`;

function normalizeCityName(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim().replace(/市$/, '');
  if (KNOWN_CITIES.includes(trimmed)) return trimmed;
  for (const city of KNOWN_CITIES) {
    if (trimmed.includes(city) || city.includes(trimmed)) return city;
  }
  return trimmed.length >= 2 ? trimmed : null;
}

function normalizeProvinceCode(raw: string): string | null {
  const key = raw.trim().toLowerCase().replace(/省$/, '');
  if (KNOWN_PROVINCE_CODES.includes(key)) return key;
  const byZh = PROVINCE_NAME_TO_CODE[raw.trim()] ?? PROVINCE_NAME_TO_CODE[key];
  return byZh ?? null;
}

function normalizeThemes(themes: string[] | undefined): string[] {
  if (!themes?.length) return [];
  const allowed = new Set<string>(ALLOWED_THEMES);
  return [...new Set(themes.map((t) => t.trim()).filter((t) => allowed.has(t)))];
}

function buildBudgetLabel(min: number | null, max: number | null, label: string | null): string | null {
  if (label?.trim()) return label.trim();
  if (min != null && max != null) return `${min}-${max}`;
  return null;
}

function toTravelIntentSnapshot(raw: z.infer<typeof llmIntentRawSchema>): TravelIntentSnapshot {
  const departureCity = normalizeCityName(raw.departureCity);
  let city = normalizeCityName(raw.destinationCity);
  const suggestedDestinations = (raw.suggestedDestinations ?? [])
    .map((item) => normalizeCityName(item))
    .filter((item): item is string => Boolean(item))
    .slice(0, 5);

  if (city && departureCity && city === departureCity) {
    city = suggestedDestinations.find((item) => item !== departureCity) ?? null;
  }

  const excludeProvinceCodes = [...new Set(
    (raw.excludeProvinceCodes ?? [])
      .map((code) => normalizeProvinceCode(code))
      .filter((code): code is string => Boolean(code)),
  )];

  const budgetMin = raw.budgetMin ?? null;
  const budgetMax = raw.budgetMax ?? null;

  let snapshot: TravelIntentSnapshot = {
    city,
    days: raw.days ?? null,
    budget: buildBudgetLabel(budgetMin, budgetMax, raw.budget ?? null),
    budgetMin,
    budgetMax,
    themes: normalizeThemes(raw.themes),
    confidence: raw.confidence ?? 'medium',
    transportPreference: raw.transportPreference ?? null,
    lodgingArea: raw.lodgingArea?.trim() || null,
    lodgingTier: raw.lodgingTier ?? null,
    cities: (raw.cities ?? [])
      .map((item) => normalizeCityName(item))
      .filter((item): item is string => Boolean(item)),
    startDate: raw.startDate?.trim() || null,
    departureCity,
    excludeProvinceCodes,
    suggestedDestinations,
    constraintSummary: raw.constraintSummary?.trim() || null,
    intentSource: 'llm',
  };

  snapshot = sanitizeTravelIntentDestinations(snapshot);
  if (!snapshot.city && (snapshot.suggestedDestinations?.length ?? 0) > 0) {
    snapshot = { ...snapshot, city: snapshot.suggestedDestinations![0] ?? null };
  }
  return snapshot;
}

function buildUserContent(
  history: PlanChatMessage[],
  currentPrompt: string,
  explicit?: { days?: number; budget?: string },
  ruleHint?: TravelIntentSnapshot,
  sessionIntent?: TravelIntentSnapshot | null,
): string {
  const lines: string[] = [];
  if (sessionIntent) {
    lines.push('【会话已确认约束 — 追问时必须完整继承，不得丢失或覆盖】');
    lines.push(JSON.stringify({
      departureCity: sessionIntent.departureCity,
      excludeProvinceCodes: sessionIntent.excludeProvinceCodes,
      days: sessionIntent.days,
      budget: sessionIntent.budget,
      themes: sessionIntent.themes,
      city: sessionIntent.city,
      startDate: sessionIntent.startDate,
      constraintSummary: sessionIntent.constraintSummary,
    }));
    lines.push('');
  }
  if (history.length > 0) {
    lines.push('【对话历史】');
    for (const item of history) {
      lines.push(`${item.role === 'user' ? '用户' : '助手'}：${item.content}`);
    }
    lines.push('');
  }
  lines.push(`【当前用户输入】\n${currentPrompt.trim()}`);
  if (explicit?.days != null || explicit?.budget?.trim()) {
    lines.push('');
    lines.push('【界面显式参数（优先于文本推断）】');
    if (explicit.days != null) lines.push(`- days: ${explicit.days}`);
    if (explicit.budget?.trim()) lines.push(`- budget: ${explicit.budget.trim()}`);
  }
  if (ruleHint) {
    lines.push('');
    lines.push('【规则引擎预解析参考（可能不准确，请结合语义修正）】');
    lines.push(JSON.stringify({
      city: ruleHint.city,
      departureCity: ruleHint.departureCity,
      excludeProvinceCodes: ruleHint.excludeProvinceCodes,
      days: ruleHint.days,
      budget: ruleHint.budget,
      themes: ruleHint.themes,
      transportPreference: ruleHint.transportPreference,
      startDate: ruleHint.startDate,
    }));
  }
  return lines.join('\n');
}

function mergeIntentSources(
  ruleIntent: TravelIntentSnapshot,
  llmIntent: TravelIntentSnapshot,
  explicit?: { days?: number; budget?: string },
): TravelIntentSnapshot {
  const themes = [...new Set([...llmIntent.themes, ...ruleIntent.themes])];
  const excludeProvinceCodes = [
    ...new Set([
      ...(llmIntent.excludeProvinceCodes ?? []),
      ...(ruleIntent.excludeProvinceCodes ?? []),
    ]),
  ];
  const merged: TravelIntentSnapshot = {
    ...llmIntent,
    themes,
    excludeProvinceCodes,
    intentSource: 'hybrid',
    confidence: llmIntent.confidence ?? ruleIntent.confidence,
  };

  if (!merged.departureCity && ruleIntent.departureCity) {
    merged.departureCity = ruleIntent.departureCity;
  }
  if (!merged.city && ruleIntent.city) {
    merged.city = ruleIntent.city;
  }

  if (explicit?.days != null) merged.days = explicit.days;
  else if (merged.days == null && ruleIntent.days != null) merged.days = ruleIntent.days;

  if (explicit?.budget?.trim()) {
    merged.budget = explicit.budget.trim();
    merged.budgetMin = ruleIntent.budgetMin;
    merged.budgetMax = ruleIntent.budgetMax;
  } else if (!merged.budget && ruleIntent.budget) {
    merged.budget = ruleIntent.budget;
    merged.budgetMin = ruleIntent.budgetMin;
    merged.budgetMax = ruleIntent.budgetMax;
  }

  if (!merged.transportPreference && ruleIntent.transportPreference) {
    merged.transportPreference = ruleIntent.transportPreference;
  }
  if (!merged.lodgingArea && ruleIntent.lodgingArea) {
    merged.lodgingArea = ruleIntent.lodgingArea;
  }
  if (!merged.lodgingTier && ruleIntent.lodgingTier) {
    merged.lodgingTier = ruleIntent.lodgingTier;
  }
  if (!merged.startDate && ruleIntent.startDate) {
    merged.startDate = ruleIntent.startDate;
  }

  return sanitizeTravelIntentDestinations(merged);
}

/** 调用 LLM 解析旅行意图 */
export async function parseTravelIntentWithLlm(
  history: PlanChatMessage[] | undefined,
  currentPrompt: string,
  explicit?: { days?: number; budget?: string },
  ruleHint?: TravelIntentSnapshot,
  sessionIntent?: TravelIntentSnapshot | null,
): Promise<TravelIntentSnapshot> {
  const safeHistory = history ?? [];
  const userContent = buildUserContent(safeHistory, currentPrompt, explicit, ruleHint, sessionIntent);
  const { data } = await chatCompletionForJson(
    INTENT_PARSE_SYSTEM_PROMPT,
    userContent,
    llmIntentRawSchema,
    { temperature: 0.2, maxTokens: 1024 },
  );
  return toTravelIntentSnapshot(data);
}

/** 优先 LLM 解析，失败回退规则引擎 */
export async function buildIntentFromHistoryAsync(
  history: PlanChatMessage[] | undefined,
  currentPrompt: string,
  explicit?: { days?: number; budget?: string },
  sessionIntent?: TravelIntentSnapshot | null,
): Promise<TravelIntentSnapshot> {
  const ruleIntent = buildIntentFromHistory(history, currentPrompt, explicit);

  let parsed: TravelIntentSnapshot;
  if (!isLlmIntentParseEnabled()) {
    parsed = { ...ruleIntent, intentSource: 'rule' };
  } else {
    try {
      const llmIntent = await parseTravelIntentWithLlm(
        history,
        currentPrompt,
        explicit,
        ruleIntent,
        sessionIntent,
      );
      parsed = mergeIntentSources(ruleIntent, llmIntent, explicit);
    } catch (err) {
      console.warn(
        '[intent] LLM 解析失败，回退规则引擎:',
        err instanceof Error ? err.message : err,
      );
      parsed = { ...ruleIntent, intentSource: 'rule' };
    }
  }

  return finalizePlanningIntent(
    mergeSessionIntentSnapshot(sessionIntent, parsed, currentPrompt),
  );
}
