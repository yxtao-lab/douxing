import { z } from 'zod';
import { PoiCategory } from '@douxing/shared';
import type {
  LocaleCode,
  PlanChatMessage,
  TravelIntentSnapshot,
  RagAttractionCandidate,
} from '@douxing/shared';
import { DEFAULT_LOCALE, ApiError, ApiMessageKey } from '@douxing/shared';
import {
  type LlmProviderId,
  type LlmProviderChoice,
  getProviderConfig,
  resolveProviderChain,
  isLlmEnabled,
  hasDeepseekApiKey,
  getLmStudioConfig,
  getDeepseekConfig,
} from '../config/llm.js';
import { formatIntentConstraintsForLlm } from './travel-intent.service.js';
import { formatRagContextForLlm } from './attraction-rag.service.js';

const poiTypeEnum = z.enum([
  PoiCategory.ATTRACTION,
  PoiCategory.RESTAURANT,
  PoiCategory.HOTEL,
  PoiCategory.MEAL,
  PoiCategory.TRANSPORT,
  PoiCategory.OTHER,
]);

const routeSpotSchema = z
  .object({
    name: z.string().min(1),
    time: z.string().min(1),
    cost: z.number().min(0),
    description: z.string().min(1),
    poiType: poiTypeEnum,
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .superRefine((spot, ctx) => {
    if (
      spot.poiType === PoiCategory.RESTAURANT ||
      spot.poiType === PoiCategory.HOTEL
    ) {
      const generic = /^(午餐|晚餐|早餐|吃饭|用膳|住宿|入住酒店|酒店休息)$/;
      if (generic.test(spot.name.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '餐厅/酒店须使用具体店名，笼统用餐/住宿请用 poiType=meal',
          path: ['name'],
        });
      }
    }
  });

const daySchema = z.object({
  date: z.string().min(1),
  title: z.string().min(1),
  attractions: z.array(routeSpotSchema).min(1),
});

export const llmRouteSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  budgetRange: z.string().min(1),
  days: z.number().int().min(1).max(7),
  interestTags: z.array(z.string()).min(1),
  matchedCity: z.string().min(1),
  unlockPrice: z.number().min(0).max(999),
  routeDetail: z.object({
    days: z.array(daySchema).min(1),
  }),
});

export type LlmRoutePayload = z.infer<typeof llmRouteSchema>;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string };
  }>;
  error?: { message?: string };
}

export interface ProviderStatus {
  id: LlmProviderId;
  label: string;
  configured: boolean;
  available: boolean;
  model?: string;
  error?: string;
}

const SYSTEM_PROMPT = `你是兜行（Douxing）旅游规划助手。根据用户需求生成中国境内旅行路线。
必须只输出一个 JSON 对象，不要 markdown 代码块，不要其他说明文字。
JSON 结构：
{
  "name": "路线标题",
  "description": "100字以内路线简介",
  "budgetRange": "如 2000-4000",
  "days": 天数整数1-7,
  "interestTags": ["标签1","标签2"],
  "matchedCity": "主要城市名",
  "unlockPrice": 9.9,
  "routeDetail": {
    "days": [
      {
        "date": "第1天",
        "title": "当日主题",
        "attractions": [
          {
            "name": "景点或具体店名",
            "time": "09:00-11:00",
            "cost": 0,
            "description": "简短说明",
            "poiType": "attraction",
            "latitude": 30.25,
            "longitude": 120.15
          }
        ]
      }
    ]
  }
}
要求：
1. 每天2-4个节点；days 与 routeDetail.days 长度一致；cost 为人民币数字。
2. poiType 取值：attraction（景区/地标）、restaurant（具体餐厅名）、hotel（具体酒店名）、meal（笼统用餐如「午餐」不入库）、transport、other。
3. 笼统「午餐」「晚餐」「自行用餐」「入住酒店」等必须用 poiType=meal 或 other，禁止虚构店名。
4. poiType=attraction 时必须填写真实可参考的 latitude、longitude（中国境内 WGS84）。
5. poiType=restaurant/hotel 时 name 必须是具体店名；鼓励填写 latitude、longitude。
6. 若用户消息中提供了「内容库候选 POI」JSON，poiType=attraction 的节点必须优先从中选用，name 与库内完全一致，cost 与坐标使用库内数据；不得编造库中不存在的景区名。`;

const MULTI_TURN_HINT = `
7. 若对话历史中已有路线方案，用户可能在追问或要求修改（如增减天数、替换景点、调整预算），请结合上下文理解意图，输出完整更新后的 JSON（不要只输出 diff）。`;

const LOCALE_OUTPUT_HINT_EN = `
8. Output language: English. Fields name, description, each day date/title, and attraction descriptions must be in English. interestTags may stay as short Chinese theme words from the user or English equivalents. City names (e.g. Hangzhou) may stay as commonly used English exonyms.`;

const LOCALE_OUTPUT_HINT_ZH = `
8. 输出语言：简体中文。name、description、每日 date/title 及景点说明均使用中文。`;

function buildSystemPrompt(hasHistory: boolean, locale: LocaleCode = DEFAULT_LOCALE): string {
  const localeHint = locale === 'en-US' ? LOCALE_OUTPUT_HINT_EN : LOCALE_OUTPUT_HINT_ZH;
  const base = SYSTEM_PROMPT + localeHint;
  return hasHistory ? base + MULTI_TURN_HINT : base;
}

function buildAssistantHistoryContent(message: PlanChatMessage): string {
  return message.content;
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }
  return trimmed;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

async function resolveModelId(provider: LlmProviderId): Promise<string> {
  const config = getProviderConfig(provider);
  if (provider === 'deepseek' || (config.model && config.model !== 'local-model')) {
    return config.model;
  }
  try {
    const res = await fetchWithTimeout(
      `${config.baseUrl}/models`,
      { method: 'GET', headers: authHeaders(config.apiKey) },
      5000,
    );
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      const first = data.data?.find((m) => m.id && !m.id.includes('embed'));
      if (first?.id) return first.id;
    }
  } catch {
    /* 使用配置默认模型 */
  }
  return config.model;
}

export async function checkProviderStatus(provider: LlmProviderId): Promise<ProviderStatus> {
  const config = getProviderConfig(provider);
  const base: ProviderStatus = {
    id: provider,
    label: config.label,
    configured: config.configured,
    available: false,
  };

  if (!config.configured) {
    return {
      ...base,
      error: provider === 'deepseek' ? '未配置 DEEPSEEK_API_KEY' : '本地服务未配置',
    };
  }

  try {
    const res = await fetchWithTimeout(
      `${config.baseUrl}/models`,
      { method: 'GET', headers: authHeaders(config.apiKey) },
      8000,
    );
    if (!res.ok) {
      return { ...base, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const model =
      provider === 'deepseek'
        ? config.model
        : data.data?.find((m) => m.id && !m.id.includes('embed'))?.id ?? config.model;
    return { ...base, available: true, model };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : '连接失败',
    };
  }
}

export async function getAllProvidersStatus(): Promise<{
  enabled: boolean;
  defaultProvider: string;
  deepseekConfigured: boolean;
  providers: ProviderStatus[];
}> {
  const providers = await Promise.all([
    checkProviderStatus('deepseek'),
    checkProviderStatus('lmstudio'),
  ]);
  return {
    enabled: isLlmEnabled(),
    defaultProvider: process.env.LLM_DEFAULT_PROVIDER ?? 'auto',
    deepseekConfigured: hasDeepseekApiKey(),
    providers,
  };
}

/** @deprecated 使用 getAllProvidersStatus */
export async function checkLlmAvailability(): Promise<{
  available: boolean;
  model?: string;
  error?: string;
}> {
  const all = await getAllProvidersStatus();
  const ready = all.providers.find((p) => p.available);
  if (ready) {
    return { available: true, model: ready.model };
  }
  const err = all.providers.map((p) => `${p.label}: ${p.error ?? '不可用'}`).join('; ');
  return { available: false, error: err || '无可用模型' };
}

async function chatCompletionWithProvider(
  provider: LlmProviderId,
  userPrompt: string,
  options?: {
    days?: number;
    budget?: string;
    history?: PlanChatMessage[];
    intent?: TravelIntentSnapshot;
    ragCandidates?: RagAttractionCandidate[];
    variantHint?: string;
    locale?: LocaleCode;
  },
): Promise<LlmRoutePayload> {
  const config = getProviderConfig(provider);
  if (!config.configured) {
    throw new Error(`${config.label} 未配置`);
  }

  const model = await resolveModelId(provider);
  const blocks: string[] = [];
  if (options?.intent) {
    const constraintBlock = formatIntentConstraintsForLlm(options.intent);
    if (constraintBlock) blocks.push(constraintBlock);
  } else {
    if (options?.days) blocks.push(`（期望天数：${options.days}天）`);
    if (options?.budget) blocks.push(`（预算：${options.budget}）`);
  }
  if (options?.ragCandidates?.length) {
    blocks.push(formatRagContextForLlm(options.ragCandidates));
  }
  if (options?.variantHint?.trim()) {
    blocks.push(`【本方案风格 — 与其他候选路线需有明显差异】\n${options.variantHint.trim()}`);
  }
  const userContent =
    blocks.length > 0
      ? `${blocks.join('\n\n')}\n\n用户需求：${userPrompt}`
      : userPrompt;

  const history = options?.history ?? [];
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(history.length > 0, locale) },
    ...history.map((item) => ({
      role: item.role,
      content: buildAssistantHistoryContent(item),
    })),
    { role: 'user', content: userContent },
  ];

  const baseBody = {
    model,
    messages,
    temperature: 0.6,
    max_tokens: 2048,
    stream: false,
  };

  const useJsonMode = provider === 'deepseek';

  let res = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: authHeaders(config.apiKey),
      body: JSON.stringify(
        useJsonMode ? { ...baseBody, response_format: { type: 'json_object' } } : baseBody,
      ),
    },
    config.timeoutMs,
  );

  let data = (await res.json()) as ChatCompletionResponse;
  if (!res.ok && useJsonMode) {
    res = await fetchWithTimeout(
      `${config.baseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify(baseBody),
      },
      config.timeoutMs,
    );
    data = (await res.json()) as ChatCompletionResponse;
  }

  if (!res.ok) {
    throw new Error(data.error?.message ?? `${config.label} 请求失败 HTTP ${res.status}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${config.label} 返回内容为空`);
  }

  const jsonText = extractJsonObject(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error(`${config.label} 返回的不是有效 JSON`);
  }

  const result = llmRouteSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`返回格式不符合要求: ${result.error.errors[0]?.message}`);
  }

  if (result.data.routeDetail.days.length !== result.data.days) {
    result.data.days = result.data.routeDetail.days.length;
  }

  return result.data;
}

/** 按提供商链依次尝试生成路线 */
export async function chatCompletionForRoute(
  userPrompt: string,
  options?: {
    days?: number;
    budget?: string;
    provider?: LlmProviderChoice;
    history?: PlanChatMessage[];
    intent?: TravelIntentSnapshot;
    ragCandidates?: RagAttractionCandidate[];
    variantHint?: string;
    locale?: LocaleCode;
  },
): Promise<{ payload: LlmRoutePayload; provider: LlmProviderId }> {
  const chain = resolveProviderChain(options?.provider);
  if (chain.length === 0) {
    throw new ApiError(ApiMessageKey.LLM_NO_MODEL);
  }

  const errors: string[] = [];
  for (const provider of chain) {
    try {
      const payload = await chatCompletionWithProvider(provider, userPrompt, options);
      return { payload, provider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${getProviderConfig(provider).label}: ${msg}`);
      console.warn(`[llm] ${provider} 失败:`, msg);
    }
  }

  throw new Error(errors.join(' | '));
}

export function listProviderOptions(): Array<{
  id: LlmProviderChoice;
  label: string;
  available: boolean;
}> {
  return [
    {
      id: 'auto',
      label: '自动（优先 DeepSeek，其次本地）',
      available: hasDeepseekApiKey() || true,
    },
    {
      id: 'deepseek',
      label: `DeepSeek（${getDeepseekConfig().model}）`,
      available: hasDeepseekApiKey(),
    },
    {
      id: 'lmstudio',
      label: '本地 LM Studio',
      available: true,
    },
  ];
}
