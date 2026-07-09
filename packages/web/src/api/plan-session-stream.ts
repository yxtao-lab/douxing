import {
  AUTH_TOKEN_KEY,
  consumeSseBuffer,
  dispatchPlanSessionStreamEvent,
  LOCALE_STORAGE_KEY,
  DEFAULT_LOCALE,
  isLocaleCode,
  type PlanSessionStreamHandlers,
} from '@douxing/shared';

export interface StartAdminPlanSessionStreamOptions {
  sessionId: number;
  signal?: AbortSignal;
  handlers: PlanSessionStreamHandlers;
}

/**
 * 读取 Web 端当前 UI 语言。
 *
 * @returns zh-CN 或 en-US
 */
function readWebLocale(): string {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocaleCode(stored)) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

/**
 * 订阅管理端规划沙箱 SSE（tool_call / done / error）。
 *
 * @param options - sessionId、AbortSignal 与事件回调
 * @returns 取消订阅函数
 */
export function startAdminPlanSessionStreamSubscription(
  options: StartAdminPlanSessionStreamOptions,
): () => void {
  const streamAbort = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) {
      streamAbort.abort();
    } else {
      options.signal.addEventListener('abort', () => streamAbort.abort(), { once: true });
    }
  }

  const token = localStorage.getItem(AUTH_TOKEN_KEY) ?? '';
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
  const locale = readWebLocale();
  const url =
    `${base}/admin/plan-sessions/${options.sessionId}/stream` +
    `?token=${encodeURIComponent(token)}`;

  void (async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
          'Accept-Language': locale,
        },
        signal: streamAbort.signal,
      });
      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!streamAbort.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = consumeSseBuffer(buffer);
        buffer = parsed.remaining;
        for (const evt of parsed.events) {
          const terminal = dispatchPlanSessionStreamEvent(
            evt.event,
            evt.data,
            options.handlers,
          );
          if (terminal) return;
        }
      }
    } catch {
      /* SSE 不可用时由调用方降级 */
    }
  })();

  return () => streamAbort.abort();
}
