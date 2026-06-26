import {
  AnalyticsEventSource,
  createAnalyticsClient,
  type AnalyticsClient,
  type ClientAnalyticsEventPayload,
} from '@douxing/shared';
import http from '@/api/http';

let client: AnalyticsClient | null = null;

function isAnalyticsEnabled(): boolean {
  return import.meta.env.VITE_ANALYTICS_ENABLED !== 'false';
}

async function transport(events: ClientAnalyticsEventPayload[]): Promise<void> {
  await http.post('/analytics/events/batch', { events });
}

export function initAnalytics(): AnalyticsClient {
  if (client) return client;
  client = createAnalyticsClient({
    source: AnalyticsEventSource.PC,
    enabled: isAnalyticsEnabled(),
    transport,
  });
  return client;
}

export function trackAnalytics(eventName: string, properties?: Record<string, unknown>): void {
  initAnalytics().track(eventName, properties);
}
