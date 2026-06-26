import { AnalyticsEventCategory, AnalyticsEventSource } from '../constants.js';
import { isClientAnalyticsEventName } from './analytics-events.js';

const DEFAULT_FLUSH_INTERVAL_MS = 5000;
const DEFAULT_MAX_BATCH_SIZE = 10;
const MAX_QUEUE_SIZE = 100;
const ANALYTICS_SESSION_KEY = 'douxing_analytics_session';

export interface ClientAnalyticsEventPayload {
  eventName: string;
  eventCategory?: string;
  sessionId?: string;
  properties?: Record<string, unknown>;
  source?: string;
  occurredAt?: string;
}

export type AnalyticsTransport = (events: ClientAnalyticsEventPayload[]) => Promise<void>;

export interface SessionIdStorage {
  get: () => string | null;
  set: (id: string) => void;
}

export interface CreateAnalyticsClientOptions {
  source: typeof AnalyticsEventSource.MOBILE | typeof AnalyticsEventSource.PC;
  transport: AnalyticsTransport;
  enabled?: boolean;
  sessionStorage?: SessionIdStorage;
  flushIntervalMs?: number;
  maxBatchSize?: number;
}

function defaultSessionStorage(): SessionIdStorage {
  return {
    get: () => {
      try {
        return localStorage.getItem(ANALYTICS_SESSION_KEY);
      } catch {
        return null;
      }
    },
    set: (id: string) => {
      try {
        localStorage.setItem(ANALYTICS_SESSION_KEY, id);
      } catch {
        /* ignore */
      }
    },
  };
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function resolveSessionId(storage: SessionIdStorage): string {
  const existing = storage.get();
  if (existing) return existing;
  const next = createSessionId();
  storage.set(next);
  return next;
}

export function createAnalyticsClient(options: CreateAnalyticsClientOptions) {
  const enabled = options.enabled !== false;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  const sessionStorage = options.sessionStorage ?? defaultSessionStorage();
  const sessionId = resolveSessionId(sessionStorage);

  const queue: ClientAnalyticsEventPayload[] = [];
  let flushTimer: ReturnType<typeof setInterval> | null = null;
  let flushing = false;

  function scheduleFlush() {
    if (flushTimer || !enabled) return;
    flushTimer = setInterval(() => {
      void flush();
    }, flushIntervalMs);
  }

  async function flush(): Promise<void> {
    if (!enabled || flushing || queue.length === 0) return;
    flushing = true;
    const batch = queue.splice(0, maxBatchSize);
    try {
      await options.transport(batch);
    } catch {
      queue.unshift(...batch);
    } finally {
      flushing = false;
    }
  }

  function track(eventName: string, properties?: Record<string, unknown>): void {
    if (!enabled || !isClientAnalyticsEventName(eventName)) return;

    const category =
      eventName.startsWith('app.') || eventName.startsWith('share.')
        ? AnalyticsEventCategory.BEHAVIOR
        : eventName.includes('publish') || eventName.includes('create') || eventName.includes('saved')
          ? AnalyticsEventCategory.BUSINESS
          : AnalyticsEventCategory.BEHAVIOR;

    const payload: ClientAnalyticsEventPayload = {
      eventName,
      eventCategory: category,
      sessionId,
      source: options.source,
      properties: properties ?? undefined,
      occurredAt: new Date().toISOString(),
    };

    queue.push(payload);
    if (queue.length > MAX_QUEUE_SIZE) {
      queue.splice(0, queue.length - MAX_QUEUE_SIZE);
    }
    if (queue.length >= maxBatchSize) {
      void flush();
      return;
    }
    scheduleFlush();
  }

  function dispose(): void {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    void flush();
  }

  scheduleFlush();

  return {
    track,
    flush,
    dispose,
    getSessionId: () => sessionId,
  };
}

export type AnalyticsClient = ReturnType<typeof createAnalyticsClient>;
