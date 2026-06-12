import type { ApiResponse } from '@douxing/shared';
import { getApiBaseUrl } from './api-base';
import { getApiAcceptLanguage } from './api-locale-header';

export type SiteStatusPayload = {
  online: boolean;
  maintenanceMode: boolean;
};

export async function fetchPublicSiteStatus(): Promise<SiteStatusPayload> {
  const base = getApiBaseUrl();
  const url = `${base}/status`;

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      timeout: 10000,
      header: {
        'Content-Type': 'application/json',
        'Accept-Language': getApiAcceptLanguage(),
      },
      success: (res) => {
        const body = res.data as ApiResponse<SiteStatusPayload>;
        if (body && typeof body === 'object' && body.code === 0 && body.data) {
          resolve(body.data);
          return;
        }
        resolve({ online: true, maintenanceMode: false });
      },
      fail: (err) => {
        reject(err);
      },
    });
  });
}
