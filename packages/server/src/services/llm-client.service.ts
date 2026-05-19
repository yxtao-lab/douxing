import { z } from 'zod';
import { getLlmConfig } from '../config/llm.js';

const attractionSchema = z.object({
  name: z.string().min(1),
  time: z.string().min(1),
  cost: z.number().min(0),
  description: z.string().min(1),
});

const daySchema = z.object({
  date: z.string().min(1),
  title: z.string().min(1),
  attractions: z.array(attractionSchema).min(1),
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
          { "name": "景点名", "time": "09:00-11:00", "cost": 0, "description": "简短说明" }
        ]
      }
    ]
  }
}
要求：景点真实可去；每天2-4个景点；days 字段与 routeDetail.days 长度一致；费用 cost 为人民币数字。`;

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

/** 检测 LM Studio 是否在线 */
export async function checkLlmAvailability(): Promise<{
  available: boolean;
  model?: string;
  error?: string;
}> {
  const config = getLlmConfig();
  if (!config.enabled) {
    return { available: false, error: 'LLM 已禁用' };
  }

  try {
    const res = await fetchWithTimeout(
      `${config.baseUrl}/models`,
      { method: 'GET', headers: authHeaders(config.apiKey) },
      5000,
    );
    if (!res.ok) {
      return { available: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const firstModel = data.data?.[0]?.id;
    return { available: true, model: firstModel ?? config.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : '连接失败';
    return { available: false, error: message };
  }
}

async function resolveModelId(): Promise<string> {
  const config = getLlmConfig();
  if (config.model && config.model !== 'local-model') {
    return config.model;
  }
  const status = await checkLlmAvailability();
  if (status.model) return status.model;
  return config.model;
}

/** 调用 LM Studio chat/completions 生成路线 JSON */
export async function chatCompletionForRoute(
  userPrompt: string,
  options?: { days?: number; budget?: string },
): Promise<LlmRoutePayload> {
  const config = getLlmConfig();
  const model = await resolveModelId();
  let userContent = userPrompt;
  if (options?.days) userContent += `\n（期望天数：${options.days}天）`;
  if (options?.budget) userContent += `\n（预算：${options.budget}）`;

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];

  const baseBody = {
    model,
    messages,
    temperature: 0.6,
    max_tokens: 2048,
    stream: false,
  };

  let res = await fetchWithTimeout(
    `${config.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: authHeaders(config.apiKey),
      body: JSON.stringify({ ...baseBody, response_format: { type: 'json_object' } }),
    },
    config.timeoutMs,
  );

  let data = (await res.json()) as ChatCompletionResponse;
  if (!res.ok) {
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
    throw new Error(data.error?.message ?? `LLM 请求失败 HTTP ${res.status}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM 返回内容为空');
  }

  const jsonText = extractJsonObject(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('LLM 返回的不是有效 JSON');
  }

  const result = llmRouteSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`LLM 返回格式不符合要求: ${result.error.errors[0]?.message}`);
  }

  if (result.data.routeDetail.days.length !== result.data.days) {
    result.data.days = result.data.routeDetail.days.length;
  }

  return result.data;
}
