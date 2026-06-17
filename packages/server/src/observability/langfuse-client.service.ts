/**
 * Langfuse 观测（Step 11）：未配置 KEY 时零开销 no-op。
 */
import { Langfuse } from 'langfuse';
import {
  getLangfuseHost,
  getLangfuseTracingEnvironment,
  isLangfuseEnabled,
} from '../config/langfuse.js';

let client: Langfuse | null | undefined;

const SENSITIVE_KEY_PATTERN = /secret|password|token|apikey|authorization/i;

function truncateText(value: string, maxLen = 4000): string {
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen)}…`;
}

function sanitizeTraceInput(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'string') {
      sanitized[key] = truncateText(value, key === 'prompt' ? 800 : 1200);
      continue;
    }
    sanitized[key] = value;
  }
  return sanitized;
}

export function getLangfuseClient(): Langfuse | null {
  if (client !== undefined) {
    return client;
  }
  if (!isLangfuseEnabled()) {
    client = null;
    return client;
  }

  client = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY!.trim(),
    secretKey: process.env.LANGFUSE_SECRET_KEY!.trim(),
    baseUrl: getLangfuseHost(),
    environment: getLangfuseTracingEnvironment(),
  });
  return client;
}

export async function flushLangfuse(): Promise<void> {
  try {
    const lf = getLangfuseClient();
    if (lf) {
      await lf.flushAsync();
    }
  } catch (err) {
    console.warn('[langfuse] flush 失败:', err instanceof Error ? err.message : err);
  }
}

export async function traceNodeRouteGeneration(input: {
  prompt: string;
  provider: string;
  model: string;
  outputPreview: string;
  usage?: { input: number; output: number };
  durationMs: number;
  userId?: number;
  sessionId?: number;
  locale?: string;
}): Promise<void> {
  const lf = getLangfuseClient();
  if (!lf) return;

  try {
    const locale = input.locale ?? 'zh-CN';
    const tags = ['c5', 'node-llm', 'feature:route-generate', `locale:${locale}`, `provider:${input.provider}`];

    const trace = lf.trace({
      name: 'node-route-generate',
      userId: input.userId != null ? String(input.userId) : undefined,
      sessionId: input.sessionId != null ? String(input.sessionId) : undefined,
      input: sanitizeTraceInput({ prompt: input.prompt }),
      tags,
    });

    trace.generation({
      name: `llm:${input.provider}`,
      model: input.model,
      input: truncateText(input.prompt),
      output: truncateText(input.outputPreview),
      usage: input.usage,
      metadata: {
        durationMs: input.durationMs,
        provider: input.provider,
        feature: 'route-generate',
      },
    });

    trace.update({
      output: sanitizeTraceInput({
        provider: input.provider,
        durationMs: input.durationMs,
        model: input.model,
      }),
    });

    await lf.flushAsync();
  } catch (err) {
    console.warn('[langfuse] Node LLM trace 失败:', err instanceof Error ? err.message : err);
  }
}
