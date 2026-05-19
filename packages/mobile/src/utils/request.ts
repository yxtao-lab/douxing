import type { ApiResponse, UserInfo } from '@douxing/shared';
import { getApiBaseUrl } from './api-base';

const TOKEN_KEY = 'douxing_token';
const USER_KEY = 'douxing_user';

export function getStoredUser(): UserInfo | null {
  try {
    const raw = uni.getStorageSync(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: UserInfo) {
  uni.setStorageSync(TOKEN_KEY, token);
  uni.setStorageSync(USER_KEY, JSON.stringify(user));
}

export function request<T>(
  path: string,
  options: UniApp.RequestOptions = {},
): Promise<T> {
  const token = uni.getStorageSync(TOKEN_KEY);
  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header,
      },
      success: (res) => {
        const body = res.data as ApiResponse<T>;
        if (body && typeof body === 'object' && 'code' in body) {
          if (body.code === 0) {
            resolve(body.data);
            return;
          }
          reject(new Error(body.message || '请求失败'));
          return;
        }
        reject(new Error('响应格式错误'));
      },
      fail: (err) => reject(new Error(err.errMsg || '网络错误')),
    });
  });
}
