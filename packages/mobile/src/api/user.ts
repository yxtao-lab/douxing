import type {
  UserInfo,
  UpdateUserProfileRequest,
  MembershipInfo,
  UserPhotoStorageInfo,
  CompleteOnboardingRequest,
  VerificationPointsSummary,
  PointRedemptionCatalogItem,
  PointRedemptionEntitlements,
  PointRedemptionRecord,
  PointRedemptionResult,
  RedeemPointsRequest,
} from '@douxing/shared';
import { request, setAuth } from '@/utils/request';
import { getApiBaseUrl, assertRemoteApiBase } from '@/utils/api-base';
import { resolveClientRequestErrorMessage } from '@douxing/shared';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { mobileT } from '@/i18n/mobileT';

const TOKEN_KEY = 'douxing_token';

/**
 * 获取当前登录用户资料。
 *
 * @returns UserInfo
 */
export function fetchCurrentUser() {
  return request<UserInfo>('/users/me');
}

/**
 * 获取会员信息。
 *
 * @returns MembershipInfo
 */
export function fetchMembershipInfo() {
  return request<MembershipInfo>('/users/me/membership');
}

/**
 * 获取相册存储配额。
 *
 * @returns UserPhotoStorageInfo
 */
export function fetchPhotoStorage() {
  return request<UserPhotoStorageInfo>('/users/me/storage');
}

/**
 * U4：获取验证积分余额与账本。
 *
 * @param page - 页码
 * @param pageSize - 每页条数
 * @returns 余额与事件列表
 */
export function fetchVerificationPoints(page = 1, pageSize = 20) {
  return request<VerificationPointsSummary>(
    `/users/me/verification-points?page=${page}&pageSize=${pageSize}`,
  );
}

/**
 * G-INCENTIVE-01：兑换目录与权益。
 *
 * @returns 目录与权益快照
 */
export function fetchRedemptionCatalog() {
  return request<{
    catalog: PointRedemptionCatalogItem[];
    entitlements: PointRedemptionEntitlements;
  }>('/users/me/redemption/catalog');
}

/**
 * G-INCENTIVE-01：兑换记录。
 *
 * @param limit - 条数
 * @returns 记录列表
 */
export function fetchRedemptionHistory(limit = 20) {
  return request<{ items: PointRedemptionRecord[] }>(
    `/users/me/redemption/history?limit=${limit}`,
  );
}

/**
 * G-INCENTIVE-01：兑换商品。
 *
 * @param data - 商品与可选幂等键
 * @returns 兑换结果
 */
export function redeemPoints(data: RedeemPointsRequest) {
  return request<PointRedemptionResult>('/users/me/redemption/redeem', {
    method: 'POST',
    data,
  });
}

/**
 * 更新用户资料，并同步本地缓存。
 *
 * @param data - 待更新字段
 * @returns 更新后的 UserInfo
 */
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

/**
 * 完成首次标签引导（P-ONBOARD-01），并同步本地缓存。
 *
 * @param data - 引导选择；skipped=true 时整页用默认值
 * @returns 更新后的 UserInfo（含 onboardedAt）
 */
export async function completeOnboarding(data: CompleteOnboardingRequest) {
  const user = await request<UserInfo>('/users/me/onboarding/complete', {
    method: 'POST',
    data,
  });
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  if (token) {
    setAuth(token, user);
  }
  return user;
}

/**
 * 上传用户头像。
 *
 * @param filePath - 本地临时路径
 * @returns 更新后的 UserInfo
 */
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
      fail: (err) =>
        reject(new Error(resolveClientRequestErrorMessage(err.errMsg, getApiAcceptLanguage()))),
    });
  });
}
