import { ApiError, ApiMessageKey } from '@douxing/shared';
import {
  canUseAiService,
  getAiServiceBaseUrl,
  getAiServiceTimeoutMs,
} from '../config/ai-service.js';
import { llmRouteSchema, type LlmRoutePayload } from './llm-client.service.js';
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

type AiServiceProviderChoice = 'auto' | 'deepseek' | 'lmstudio';

/**
 * 将 Node 侧 provider 映射为 Python 微服务可接受的取值；兜行专属模型仅 Node LLM 支持。
 *
 * @param provider - 路线生成请求的模型选择
 * @returns Python `/v1/route/generate` 接受的 provider；`douxing` 返回 `null` 表示不应调用微服务
 */
function resolveAiServiceProvider(
  provider: GenerateRouteInput['provider'],
): AiServiceProviderChoice | null {
  const selected = provider ?? 'auto';
  if (selected === 'douxing') return null;
  return selected;
}

/**
 * 格式化 FastAPI 422 等错误响应中的 `detail` 字段，便于日志排查。
 *
 * @param detail - 响应体中的 `detail` 字段
 * @returns 面向日志的单行摘要
 */
function formatAiServiceErrorDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item !== 'object' || item === null) return String(item);
        const loc = 'loc' in item && Array.isArray(item.loc) ? item.loc.join('.') : '';
        const msg = 'msg' in item && typeof item.msg === 'string' ? item.msg : '';
        return loc && msg ? `${loc}: ${msg}` : msg || JSON.stringify(item);
      })
      .join('; ');
  }
  if (detail !== undefined) return JSON.stringify(detail);
  return '';
}

function buildGenerateBody(input: GenerateRouteInput) {
  const locale = input.locale ?? 'zh-CN';
  const provider = resolveAiServiceProvider(input.provider);
  if (!provider) {
    throw new Error('Python AI 微服务不支持兜行专属模型 provider=douxing');
  }
  return {
    prompt: input.prompt.trim(),
    days: input.intent?.days ?? input.days,
    budget: input.intent?.budget ?? input.budget,
    provider,
    history: input.history ?? [],
    intent: input.intent ?? null,
    ragCandidates: input.ragCandidates ?? [],
    playbookMatches: (input.playbookMatches ?? []).map(({ playbook, score }) => ({
      id: playbook.id,
      city: playbook.city,
      scope: playbook.scope,
      summary: locale === 'en-US' ? playbook.summaryEn : playbook.summaryZh,
      classicOrder: playbook.classicOrder,
      score,
    })),
    variantHint: input.variantHint ?? null,
    locale,
    userId: input.userId ?? null,
    sessionId: input.sessionId ?? null,
  };
}

/** 调用 Python AI 微服务生成路线 */
export async function generateRouteViaAiService(
  input: GenerateRouteInput,
): Promise<{ payload: LlmRoutePayload; provider: 'deepseek' | 'lmstudio' }> {
  if (!canUseAiService()) {
    throw new ApiError(ApiMessageKey.AI_SERVICE_DISABLED);
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
    const rawDetail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? (data as { detail?: unknown }).detail
        : undefined;
    const detail = formatAiServiceErrorDetail(rawDetail) || `HTTP ${res.status}`;
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
