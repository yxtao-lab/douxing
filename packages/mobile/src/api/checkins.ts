import type { CheckInInfo, CheckInResult, CheckInTimeRange, PaginatedResult } from '@douxing/shared';
import { normalizePaginatedResult } from '@douxing/shared';
import { request } from '@/utils/request';
import { getApiBaseUrl, assertRemoteApiBase } from '@/utils/api-base';
import { resolveClientRequestErrorMessage } from '@douxing/shared';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { mobileT } from '@/i18n/mobileT';

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
  addToAlbum?: boolean;
}) {
  return request<CheckInResult>('/checkins', { method: 'POST', data });
}

function buildCheckInsQuery(params: {
  page: number;
  pageSize: number;
  routeId?: number;
  range?: CheckInTimeRange;
}) {
  const parts = [
    `page=${params.page}`,
    `pageSize=${params.pageSize}`,
  ];
  if (params.routeId != null) parts.push(`routeId=${params.routeId}`);
  if (params.range && params.range !== 'all') parts.push(`range=${params.range}`);
  return `?${parts.join('&')}`;
}

export function fetchCheckInsPage(params: {
  page: number;
  pageSize: number;
  routeId?: number;
  range?: CheckInTimeRange;
}) {
  return request<PaginatedResult<CheckInInfo>>(`/checkins${buildCheckInsQuery(params)}`);
}

export async function fetchAllCheckInsForMap(range?: CheckInTimeRange) {
  const items: CheckInInfo[] = [];
  let page = 1;
  const pageSize = 50;
  while (true) {
    const raw = await fetchCheckInsPage({ page, pageSize, range });
    const result = normalizePaginatedResult(raw, { page, pageSize });
    items.push(...result.items);
    if (!result.hasMore) break;
    page += 1;
  }
  return items;
}

export function uploadCheckInPhoto(filePath: string): Promise<string> {
  assertRemoteApiBase('上传打卡照片');
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
          reject(new Error(body.message || mobileT('common.uploadFailed')));
        } catch {
          reject(new Error(mobileT('common.invalidResponse')));
        }
      },
      fail: (err) =>
        reject(new Error(resolveClientRequestErrorMessage(err.errMsg, getApiAcceptLanguage()))),
    });
  });
}
