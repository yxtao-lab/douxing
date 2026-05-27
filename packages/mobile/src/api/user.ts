import type { UserInfo, UpdateUserProfileRequest, MembershipInfo } from '@douxing/shared';
import { request, setAuth } from '@/utils/request';
import { getApiBaseUrl, assertRemoteApiBase } from '@/utils/api-base';
import { mobileT } from '@/i18n/mobileT';

const TOKEN_KEY = 'douxing_token';

export function fetchCurrentUser() {
  return request<UserInfo>('/users/me');
}

export function fetchMembershipInfo() {
  return request<MembershipInfo>('/users/me/membership');
}

export async function updateUserProfile(data: UpdateUserProfileRequest) {
  const user = await request<UserInfo>('/users/me', {
    method: 'PUT',
    data,
  });
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  if (token) {
    setAuth(token, user);
  }
  return user;
}

export function uploadUserAvatar(filePath: string): Promise<UserInfo> {
  assertRemoteApiBase('上传头像');
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  const base = getApiBaseUrl();
  const url = `${base}/users/me/avatar`;

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
            data: UserInfo;
          };
          if (body.code === 0) {
            if (token) {
              setAuth(token, body.data);
            }
            resolve(body.data);
            return;
          }
          reject(new Error(body.message || mobileT('common.uploadFailed')));
        } catch {
          reject(new Error(mobileT('common.invalidResponse')));
        }
      },
      fail: (err) => reject(new Error(err.errMsg || mobileT('common.uploadFailed'))),
    });
  });
}
