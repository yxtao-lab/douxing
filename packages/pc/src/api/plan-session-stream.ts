import {
  consumeSseBuffer,
  dispatchPlanSessionStreamEvent,
  type PlanSessionStreamHandlers,
} from '@douxing/shared';

export interface StartPlanSessionStreamOptions {
  sessionId: number;
  apiBaseUrl: string;
  token: string;
  locale: string;
  signal?: AbortSignal;
  handlers: PlanSessionStreamHandlers;
}

/** 订阅规划会话 SSE；失败时静默降级（不影响 POST） */
export function startPlanSessionStreamSubscription(
  options: StartPlanSessionStreamOptions,
): () => void {
  const streamAbort = new AbortController();
  if (options.signal) {
    if (options.signal.aborted) {
      streamAbort.abort();
    } else {
      options.signal.addEventListener('abort', () => streamAbort.abort(), { once: true });
    }
  }

  const base = options.apiBaseUrl.replace(/\/$/, '');
  const url =
    `${base}/routes/plan-sessions/${options.sessionId}/stream` +
    `?token=${encodeURIComponent(options.token)}`;

  void (async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${options.token}`,
          Accept: 'text/event-stream',
          'Accept-Language': options.locale,
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
      /* SSE 不可用时由 POST 响应 toolTrace 降级 */
    }
  })();

  return () => streamAbort.abort();
}
