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
