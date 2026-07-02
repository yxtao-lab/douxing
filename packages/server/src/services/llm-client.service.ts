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
  hasDouxingLlmCredentials,
  isDouxingLlmEnabled,
  getLmStudioConfig,
  getDeepseekConfig,
  getDouxingLlmConfig,
} from '../config/llm.js';
import { formatIntentConstraintsForLlm } from './travel-intent.service.js';
import { formatRagContextForLlm } from './attraction-rag.service.js';
import { formatPlaybookContextForLlm, type MatchedRoutePlaybook } from './playbook-rag.service.js';
import { traceNodeRouteGeneration } from '../observability/langfuse-client.service.js';

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
    time: z.string().optional().default(''),
    cost: z.number().min(0),
    description: z.string().min(1),
    poiType: poiTypeEnum,
    // Python 微服务 Pydantic 序列化 Optional 为 null；与 Node .optional()（仅 undefined）对齐
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
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
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
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
            "time": "",
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
1. 每天2-4个游玩节点；days 与 routeDetail.days 长度一致；cost 为人民币数字。
2. poiType 取值：attraction（景区/地标）、restaurant（具体餐厅名）、meal（笼统用餐如「午餐」不入库）、other。禁止输出 poiType=hotel 或 transport，住宿与交通由系统自动补全。
3. 笼统「午餐」「晚餐」「自行用餐」等必须用 poiType=meal，禁止虚构店名。
4. poiType=attraction 时必须填写真实可参考的 latitude、longitude（中国境内 WGS84）。
5. poiType=restaurant 时 name 必须是具体店名；鼓励填写 latitude、longitude。
6. time 字段可留空字符串，不要编造交通或酒店时刻。
7. 若用户消息中提供了「内容库候选 POI」JSON，poiType=attraction 的节点必须优先从中选用，name 与库内完全一致，cost 与坐标使用库内数据；不得编造库中不存在的景区名。
8. 若提供了「玩法动线参考」，attractions 的排列顺序应尽量贴近其中的经典顺序；仍禁止输出 transit/lodging。
9. 若用户约束中指定了区域排除，matchedCity 及所有游玩 POI 不得位于被排除省份境内。`;

const MULTI_TURN_HINT = `
8. 若对话历史中已有路线方案，用户可能在追问或要求修改（如增减天数、替换景点、调整预算），请结合上下文理解意图，输出完整更新后的 JSON（不要只输出 diff）。`;

const LOCALE_OUTPUT_HINT_EN = `
9. Output language: English. Fields name, description, each day date/title, and attraction descriptions must be in English. interestTags may stay as short Chinese theme words from the user or English equivalents. City names (e.g. Hangzhou) may stay as commonly used English exonyms.`;

const LOCALE_OUTPUT_HINT_ZH = `
9. 输出语言：简体中文。name、description、每日 date/title 及景点说明均使用中文。`;

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

/**
 * 从 chat/completions 的 message.content 提取文本（兼容 string / 多段 content 数组）。
 *
 * @param raw - API 返回的 message.content
 * @returns 合并后的文本；无法识别时返回空字符串
 */
function extractMessageContent(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: string }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

/**
 * 解析 LLM 路线 JSON；兼容百炼 json_object 模式返回的「JSON 字符串套 JSON 对象」。
 *
 * @param content - LLM 原始文本响应
 * @returns 解析后的 JSON 值（期望为 object）
 * @throws 无法解析为 JSON 时抛出 Error
 */
function parseLlmJsonPayload(content: string): unknown {
  let jsonText = extractJsonObject(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('返回的不是有效 JSON');
  }
  for (let depth = 0; depth < 2 && typeof parsed === 'string'; depth += 1) {
    jsonText = extractJsonObject(parsed);
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      throw new Error('返回的不是有效 JSON');
    }
  }
  return parsed;
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
  if (
    provider === 'douxing' ||
    provider === 'deepseek' ||
    (config.model && config.model !== 'local-model')
  ) {
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

function providerConfigError(provider: LlmProviderId): string {
  switch (provider) {
    case 'douxing':
      return '未配置 DOUXING_LLM_API_KEY / DOUXING_LLM_MODEL';
    case 'deepseek':
      return '未配置 DEEPSEEK_API_KEY';
    default:
      return '本地服务未配置';
  }
}

/** DeepSeek / 百炼兼容模式支持 response_format=json_object */
function supportsJsonResponseFormat(provider: LlmProviderId): boolean {
  return provider === 'deepseek' || provider === 'douxing';
}

/**
 * 百炼 Qwen3 非流式调用须显式关闭 thinking，否则 API 报错。
 *
 * @param provider - LLM 提供方
 * @param body - chat/completions 请求体
 * @returns 合并 provider 专属参数后的请求体
 */
function applyProviderCompletionOptions(
  provider: LlmProviderId,
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (provider === 'douxing') {
    return { ...body, enable_thinking: false };
  }
  return body;
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
      error: providerConfigError(provider),
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
      provider === 'deepseek' || provider === 'douxing'
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
  douxingConfigured: boolean;
  douxingEnabled: boolean;
  providers: ProviderStatus[];
}> {
  const providers = await Promise.all([
    checkProviderStatus('douxing'),
    checkProviderStatus('deepseek'),
    checkProviderStatus('lmstudio'),
  ]);
  return {
    enabled: isLlmEnabled(),
    defaultProvider: process.env.LLM_DEFAULT_PROVIDER ?? 'auto',
    deepseekConfigured: hasDeepseekApiKey(),
    douxingConfigured: hasDouxingLlmCredentials(),
    douxingEnabled: isDouxingLlmEnabled(),
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

export interface RoutePlannerMessageOptions {
  days?: number;
  budget?: string;
  history?: PlanChatMessage[];
  intent?: TravelIntentSnapshot;
  ragCandidates?: RagAttractionCandidate[];
  playbookMatches?: MatchedRoutePlaybook[];
  variantHint?: string;
  locale?: LocaleCode;
  userId?: number;
  sessionId?: number;
}

/** 与线上 LLM 调用一致的 messages（用于 SFT 数据集构造） */
export function buildRoutePlannerMessages(
  userPrompt: string,
  options?: RoutePlannerMessageOptions,
): ChatMessage[] {
  const locale = options?.locale ?? DEFAULT_LOCALE;
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
  if (options?.playbookMatches?.length) {
    blocks.push(formatPlaybookContextForLlm(options.playbookMatches, locale));
  }
  if (options?.variantHint?.trim()) {
    blocks.push(`【本方案风格 — 与其他候选路线需有明显差异】\n${options.variantHint.trim()}`);
  }
  const userContent =
    blocks.length > 0
      ? `${blocks.join('\n\n')}\n\n用户需求：${userPrompt}`
      : userPrompt;

  const history = options?.history ?? [];
  return [
    { role: 'system', content: buildSystemPrompt(history.length > 0, locale) },
    ...history.map((item) => ({
      role: item.role,
      content: buildAssistantHistoryContent(item),
    })),
    { role: 'user', content: userContent },
  ];
}

async function chatCompletionWithProvider(
  provider: LlmProviderId,
  userPrompt: string,
  options?: RoutePlannerMessageOptions,
): Promise<LlmRoutePayload> {
  const config = getProviderConfig(provider);
  if (!config.configured) {
    throw new Error(`${config.label} 未配置`);
  }

  const model = await resolveModelId(provider);
  const messages = buildRoutePlannerMessages(userPrompt, options);
  const startedAt = Date.now();

  const baseBody = {
    model,
    messages,
    temperature: 0.6,
    max_tokens: 2048,
    stream: false,
  };

  const useJsonMode = supportsJsonResponseFormat(provider);

  const buildBody = (withJsonMode: boolean) =>
    applyProviderCompletionOptions(
      provider,
      withJsonMode ? { ...baseBody, response_format: { type: 'json_object' } } : baseBody,
    );

  let res = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: authHeaders(config.apiKey),
      body: JSON.stringify(buildBody(useJsonMode)),
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
        body: JSON.stringify(buildBody(false)),
      },
      config.timeoutMs,
    );
    data = (await res.json()) as ChatCompletionResponse;
  }

  if (!res.ok) {
    throw new Error(data.error?.message ?? `${config.label} 请求失败 HTTP ${res.status}`);
  }

  const content = extractMessageContent(data.choices?.[0]?.message?.content);
  if (!content.trim()) {
    throw new Error(`${config.label} 返回内容为空`);
  }

  let parsed: unknown;
  try {
    parsed = parseLlmJsonPayload(content);
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

  result.data.routeDetail.days = result.data.routeDetail.days.map((day) => ({
    ...day,
    attractions: day.attractions.filter(
      (spot) => spot.poiType !== PoiCategory.HOTEL && spot.poiType !== PoiCategory.TRANSPORT,
    ),
  }));

  try {
    await traceNodeRouteGeneration({
      prompt: userPrompt,
      provider,
      model,
      outputPreview: content,
      usage: data.usage
        ? {
            input: data.usage.prompt_tokens ?? 0,
            output: data.usage.completion_tokens ?? 0,
          }
        : undefined,
      durationMs: Date.now() - startedAt,
      userId: options?.userId,
      sessionId: options?.sessionId,
      locale: options?.locale,
    });
  } catch (err) {
    console.warn('[llm] Langfuse trace 失败:', err instanceof Error ? err.message : err);
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
    playbookMatches?: MatchedRoutePlaybook[];
    variantHint?: string;
    locale?: LocaleCode;
    userId?: number;
    sessionId?: number;
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

export interface JsonCompletionOptions {
  provider?: LlmProviderChoice;
  temperature?: number;
  maxTokens?: number;
}

/** 通用 JSON 结构化 LLM 调用（意图解析等） */
export async function chatCompletionForJson<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>,
  options?: JsonCompletionOptions,
): Promise<{ data: T; provider: LlmProviderId }> {
  const chain = resolveProviderChain(options?.provider);
  if (chain.length === 0) {
    throw new ApiError(ApiMessageKey.LLM_NO_MODEL);
  }

  const errors: string[] = [];
  for (const provider of chain) {
    try {
      const config = getProviderConfig(provider);
      if (!config.configured) {
        throw new Error(`${config.label} 未配置`);
      }

      const model = await resolveModelId(provider);
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];
      const baseBody = {
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens ?? 1024,
        stream: false,
      };
      const useJsonMode = supportsJsonResponseFormat(provider);

      const buildBody = (withJsonMode: boolean) =>
        applyProviderCompletionOptions(
          provider,
          withJsonMode ? { ...baseBody, response_format: { type: 'json_object' } } : baseBody,
        );

      let res = await fetchWithTimeout(
        `${config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: authHeaders(config.apiKey),
          body: JSON.stringify(buildBody(useJsonMode)),
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
            body: JSON.stringify(buildBody(false)),
          },
          config.timeoutMs,
        );
        data = (await res.json()) as ChatCompletionResponse;
      }

      if (!res.ok) {
        throw new Error(data.error?.message ?? `${config.label} 请求失败 HTTP ${res.status}`);
      }

      const content = extractMessageContent(data.choices?.[0]?.message?.content);
      if (!content.trim()) {
        throw new Error(`${config.label} 返回内容为空`);
      }

      let parsed: unknown;
      try {
        parsed = parseLlmJsonPayload(content);
      } catch {
        throw new Error(`${config.label} 返回的不是有效 JSON`);
      }

      const result = schema.safeParse(parsed);
      if (!result.success) {
        throw new Error(`返回格式不符合要求: ${result.error.errors[0]?.message}`);
      }

      return { data: result.data, provider };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${getProviderConfig(provider).label}: ${msg}`);
      console.warn(`[llm-json] ${provider} 失败:`, msg);
    }
  }

  throw new Error(errors.join(' | '));
}

export function listProviderOptions(): Array<{
  id: LlmProviderChoice;
  label: string;
  available: boolean;
}> {
  const douxing = getDouxingLlmConfig();
  return [
    {
      id: 'auto',
      label: '自动（优先兜行微调 → DeepSeek → 本地）',
      available: isDouxingLlmEnabled() || hasDeepseekApiKey() || true,
    },
    {
      id: 'douxing',
      label: `兜行专属（${douxing.model}）`,
      available: isDouxingLlmEnabled(),
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
