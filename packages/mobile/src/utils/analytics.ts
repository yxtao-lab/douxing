import {
  AnalyticsEventSource,
  createAnalyticsClient,
  type AnalyticsClient,
  type ClientAnalyticsEventPayload,
} from '@douxing/shared';
import { request } from '@/utils/request';

const ANALYTICS_SESSION_KEY = 'douxing_analytics_session';

let client: AnalyticsClient | null = null;

function isAnalyticsEnabled(): boolean {
  return import.meta.env.VITE_ANALYTICS_ENABLED !== 'false';
}

async function transport(events: ClientAnalyticsEventPayload[]): Promise<void> {
  await request<{ ok: boolean; count?: number }>('/analytics/events/batch', {
    method: 'POST',
    data: { events },
  });
}

export function initAnalytics(): AnalyticsClient {
  if (client) return client;
  client = createAnalyticsClient({
    source: AnalyticsEventSource.MOBILE,
    enabled: isAnalyticsEnabled(),
    transport,
    sessionStorage: {
      get: () => {
        try {
          return uni.getStorageSync(ANALYTICS_SESSION_KEY) as string | null;
        } catch {
          return null;
        }
      },
      set: (id: string) => {
        try {
          uni.setStorageSync(ANALYTICS_SESSION_KEY, id);
        } catch {
          /* ignore */
        }
      },
    },
  });
  return client;
}

export function trackAnalytics(eventName: string, properties?: Record<string, unknown>): void {
  initAnalytics().track(eventName, properties);
}
