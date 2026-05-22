import type { CheckInInfo, CheckInResult } from '@douxing/shared';
import { request } from '@/utils/request';
import { getApiBaseUrl } from '@/utils/api-base';

const TOKEN_KEY = 'douxing_token';

export function createCheckIn(data: {
  routeId: number;
  attractionId?: number;
  cityCode?: string;
  cityName?: string;
  targetLatitude?: number;
  targetLongitude?: number;
  gpsAccuracy?: number;
  location: {
    placeName: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  photos?: string[];
  remark?: string;
}) {
  return request<CheckInResult>('/checkins', { method: 'POST', data });
}

export function fetchCheckIns(routeId?: number) {
  const query = routeId ? `?routeId=${routeId}` : '';
  return request<CheckInInfo[]>(`/checkins${query}`);
}

export function uploadCheckInPhoto(filePath: string): Promise<string> {
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  const base = getApiBaseUrl();
  const url = `${base}/checkins/photos`;

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data as string) as {
            code: number;
            message: string;
            data: { url: string };
          };
          if (body.code === 0) {
            resolve(body.data.url);
            return;
          }
          reject(new Error(body.message || '上传失败'));
        } catch {
          reject(new Error('响应格式错误'));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || '上传失败')),
    });
  });
}
