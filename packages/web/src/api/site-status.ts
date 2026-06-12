import type { ApiResponse } from '@douxing/shared';
import http from './http';

export type SiteStatusPayload = {
  online: boolean;
  maintenanceMode: boolean;
};

export async function fetchPublicSiteStatus(): Promise<SiteStatusPayload> {
  const { data } = await http.get<ApiResponse<SiteStatusPayload>>('/status');
  return data.data;
}

export async function fetchSiteStatus(): Promise<SiteStatusPayload> {
  const { data } = await http.get<ApiResponse<SiteStatusPayload>>('/system/site-status');
  return data.data;
}

export async function updateSiteOnline(online: boolean): Promise<SiteStatusPayload> {
  const { data } = await http.put<ApiResponse<SiteStatusPayload>>(
    '/system/site-status',
    { online },
    { timeout: 30000 },
  );
  return data.data;
}
