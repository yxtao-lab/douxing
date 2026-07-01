import type { NextFunction, Request, Response } from 'express';
import { API_PREFIX, resolveApiLogMeta } from '@douxing/shared';
import { getClientIp, recordApiLog } from '../services/sys-log.service.js';

const MAX_BODY_CHARS = Number(process.env.API_LOG_MAX_BODY_CHARS) || 8000;
const SKIP_PREFIXES = ['/uploads/', `${API_PREFIX}/health`];

const SENSITIVE_KEY_RE = /password|token|authorization|secret|apikey|api_key/i;

/**
 * 判断当前请求是否跳过接口日志记录。
 */
function shouldSkipApiLog(req: Request): boolean {
  const path = req.originalUrl.split('?')[0] ?? '';
  if (!path.startsWith(API_PREFIX)) return true;
  return SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * 递归脱敏请求/响应中的敏感字段。
 */
function maskSensitive(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(maskSensitive);
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_RE.test(key) ? '***' : maskSensitive(val);
  }
  return result;
}

/**
 * 截断超长文本，避免日志表膨胀。
 */
function truncateText(text: string): string {
  if (text.length <= MAX_BODY_CHARS) return text;
  return `${text.slice(0, MAX_BODY_CHARS)}\n... [truncated]`;
}

/**
 * 序列化请求 query 与 body 为 JSON 文本。
 */
function serializeRequestPayload(
  body: unknown,
  query: Record<string, unknown>,
): string | null {
  const payload: Record<string, unknown> = {};
  if (Object.keys(query).length > 0) payload.query = maskSensitive(query);
  if (
    body !== undefined &&
    body !== null &&
    (typeof body !== 'object' || Object.keys(body as object).length > 0)
  ) {
    payload.body = maskSensitive(body);
  }
  if (Object.keys(payload).length === 0) return null;
  try {
    return truncateText(JSON.stringify(payload, null, 2));
  } catch {
    return truncateText(String(payload));
  }
}

/**
 * 记录 API 请求与响应，便于管理端排错。
 */
export function apiLogMiddleware(req: Request, res: Response, next: NextFunction) {
  if (shouldSkipApiLog(req)) {
    next();
    return;
  }

  const start = Date.now();
  let responseBody = '';
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function jsonOverride(body: unknown) {
    try {
      responseBody = truncateText(JSON.stringify(maskSensitive(body), null, 2));
    } catch {
      responseBody = truncateText(String(body));
    }
    return originalJson(body);
  };

  res.send = function sendOverride(body: unknown) {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      responseBody = truncateText(typeof body === 'string' ? body : body.toString('utf8'));
    }
    return originalSend(body);
  };

  res.on('finish', () => {
    const costTime = Date.now() - start;
    const statusCode = res.statusCode;
    const status = statusCode >= 200 && statusCode < 400 ? 1 : 0;
    let errorMsg: string | undefined;
    if (status === 0 && responseBody) {
      try {
        const parsed = JSON.parse(responseBody) as { message?: string };
        errorMsg = parsed.message?.slice(0, 512);
      } catch {
        errorMsg = responseBody.slice(0, 512);
      }
    }

    void recordApiLog({
      operName: req.auth?.username ?? 'anonymous',
      requestUrl: (req.originalUrl.split('?')[0] ?? req.path).slice(0, 512),
      method: req.method,
      apiModule: resolveApiLogMeta(req.method, req.originalUrl).moduleKey,
      requestParams: serializeRequestPayload(req.body, req.query as Record<string, unknown>),
      responseBody: responseBody || null,
      statusCode,
      operIp: getClientIp(req),
      costTime,
      status,
      errorMsg,
    });
  });

  next();
}
