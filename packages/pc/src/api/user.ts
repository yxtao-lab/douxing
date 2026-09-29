import http from './http';
import type {
  ApiResponse,
  CompleteOnboardingRequest,
  MembershipInfo,
  PointRedemptionCatalogItem,
  PointRedemptionEntitlements,
  PointRedemptionRecord,
  PointRedemptionResult,
  RedeemPointsRequest,
  UpdateUserProfileRequest,
  UserInfo,
  UserPhotoStorageInfo,
  VerificationPointsSummary,
} from '@douxing/shared';

/**
 * 获取会员信息。
 *
 * @returns MembershipInfo
 */
export async function fetchMembershipInfo() {
  const { data } = await http.get<ApiResponse<MembershipInfo>>('/users/me/membership');
  return data.data;
}

/**
 * 获取相册存储配额。
 *
 * @returns UserPhotoStorageInfo
 */
export async function fetchPhotoStorage() {
  const { data } = await http.get<ApiResponse<UserPhotoStorageInfo>>('/users/me/storage');
  return data.data;
}

/**
 * U4：获取验证积分余额与账本。
 *
 * @param page - 页码
 * @param pageSize - 每页条数
 * @returns 余额与事件列表
 */
export async function fetchVerificationPoints(page = 1, pageSize = 20) {
  const { data } = await http.get<ApiResponse<VerificationPointsSummary>>(
    '/users/me/verification-points',
    { params: { page, pageSize } },
  );
  return data.data;
}

/**
 * G-INCENTIVE-01：兑换目录与权益。
 *
 * @returns 目录与权益快照
 */
export async function fetchRedemptionCatalog() {
  const { data } = await http.get<
    ApiResponse<{
      catalog: PointRedemptionCatalogItem[];
      entitlements: PointRedemptionEntitlements;
    }>
  >('/users/me/redemption/catalog');
  return data.data;
}

/**
 * G-INCENTIVE-01：兑换记录。
 *
 * @param limit - 条数
 * @returns 记录列表
 */
export async function fetchRedemptionHistory(limit = 20) {
  const { data } = await http.get<ApiResponse<{ items: PointRedemptionRecord[] }>>(
    `/users/me/redemption/history?limit=${limit}`,
  );
  return data.data;
}

/**
 * G-INCENTIVE-01：兑换商品。
 *
 * @param body - 商品与可选幂等键
 * @returns 兑换结果
 */
export async function redeemPoints(body: RedeemPointsRequest) {
  const { data } = await http.post<ApiResponse<PointRedemptionResult>>(
    '/users/me/redemption/redeem',
    body,
  );
  return data.data;
}

/**
 * 获取当前用户资料。
 *
 * @returns UserInfo
 */
export async function fetchUserProfile() {
  const { data } = await http.get<ApiResponse<UserInfo>>('/users/me');
  return data.data;
}

/**
 * 更新用户资料。
 *
 * @param body - 待更新字段
 * @returns 更新后的 UserInfo
 */
export async function updateUserProfile(body: UpdateUserProfileRequest) {
  const { data } = await http.put<ApiResponse<UserInfo>>('/users/me', body);
  return data.data;
}

/**
 * 完成首次标签引导（P-ONBOARD-01）。
 *
 * @param body - 引导选择；skipped=true 时用默认值
 * @returns 更新后的 UserInfo（含 onboardedAt）
 */
export async function completeOnboarding(body: CompleteOnboardingRequest) {
  const { data } = await http.post<ApiResponse<UserInfo>>('/users/me/onboarding/complete', body);
  return data.data;
}

/**
 * 上传用户头像。
 *
 * @param file - 图片文件
 * @returns 更新后的 UserInfo
 */
export async function uploadUserAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post<ApiResponse<UserInfo>>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}
