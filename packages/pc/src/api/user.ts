import http from './http';
import type {
  ApiResponse,
  CompleteOnboardingRequest,
  MembershipInfo,
  UpdateUserProfileRequest,
  UserInfo,
  UserPhotoStorageInfo,
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
