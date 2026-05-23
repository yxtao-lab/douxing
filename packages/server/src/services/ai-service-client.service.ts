import {
  canUseAiService,
  getAiServiceBaseUrl,
  getAiServiceTimeoutMs,
} from '../config/ai-service.js';import { llmRouteSchema, type LlmRoutePayload } from './llm-client.service.js';
import type { GenerateRouteInput } from './route-generator.service.js';

interface AiServiceGenerateResponse {
  payload: LlmRoutePayload;
  provider: 'deepseek' | 'lmstudio';
}

interface AiServiceStatusResponse {
  service: string;
  version: string;
  providers: Array<{
    id: string;
    label: string;
    configured: boolean;
    available: boolean;
    model?: string;
    error?: string;
  }>;
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

function buildGenerateBody(input: GenerateRouteInput) {
  return {
    prompt: input.prompt.trim(),
    days: input.intent?.days ?? input.days,
    budget: input.intent?.budget ?? input.budget,
    provider: input.provider ?? 'auto',
    history: input.history ?? [],
    intent: input.intent ?? null,
    ragCandidates: input.ragCandidates ?? [],
    variantHint: input.variantHint ?? null,
  };
}

/** 调用 Python AI 微服务生成路线 */
export async function generateRouteViaAiService(
  input: GenerateRouteInput,
): Promise<{ payload: LlmRoutePayload; provider: 'deepseek' | 'lmstudio' }> {
  if (!canUseAiService()) {
    throw new Error('Python AI 微服务未启用');
  }

  const baseUrl = getAiServiceBaseUrl();
  const timeoutMs = getAiServiceTimeoutMs();

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${baseUrl}/v1/route/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildGenerateBody(input)),
      },
      timeoutMs,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Python AI 微服务连接失败: ${msg}`);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Python AI 微服务返回非 JSON（HTTP ${res.status}）`);
  }

  if (!res.ok) {
    const detail =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof (data as { detail?: unknown }).detail === 'string'
        ? (data as { detail: string }).detail
        : `HTTP ${res.status}`;
    throw new Error(`Python AI 微服务请求失败: ${detail}`);
  }

  const parsed = data as AiServiceGenerateResponse;
  const validated = llmRouteSchema.safeParse(parsed.payload);
  if (!validated.success) {
    throw new Error(`Python AI 微服务返回格式无效: ${validated.error.errors[0]?.message}`);
  }

  return {
    payload: validated.data,
    provider: parsed.provider ?? 'deepseek',
  };
}

/** 探测 Python AI 微服务健康状态 */
export async function checkAiServiceStatus(): Promise<{
  enabled: boolean;
  available: boolean;
  baseUrl: string;
  error?: string;
  providers?: AiServiceStatusResponse['providers'];
}> {
  const enabled = canUseAiService();
  const baseUrl = getAiServiceBaseUrl();
  if (!enabled) {
    return { enabled: false, available: false, baseUrl };
  }

  try {
    const healthRes = await fetchWithTimeout(`${baseUrl}/health`, { method: 'GET' }, 5000);
    if (!healthRes.ok) {
      return {
        enabled: true,
        available: false,
        baseUrl,
        error: `健康检查 HTTP ${healthRes.status}`,
      };
    }

    const statusRes = await fetchWithTimeout(`${baseUrl}/v1/status`, { method: 'GET' }, 8000);
    if (!statusRes.ok) {
      return {
        enabled: true,
        available: true,
        baseUrl,
        error: `状态接口 HTTP ${statusRes.status}`,
      };
    }

    const status = (await statusRes.json()) as AiServiceStatusResponse;
    return {
      enabled: true,
      available: true,
      baseUrl,
      providers: status.providers,
    };
  } catch (err) {
    return {
      enabled: true,
      available: false,
      baseUrl,
      error: err instanceof Error ? err.message : '连接失败',
    };
  }
}
