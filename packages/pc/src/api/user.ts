import http from './http';
import type { ApiResponse, MembershipInfo, UpdateUserProfileRequest, UserInfo, UserPhotoStorageInfo } from '@douxing/shared';

export async function fetchMembershipInfo() {
  const { data } = await http.get<ApiResponse<MembershipInfo>>('/users/me/membership');
  return data.data;
}

export async function fetchPhotoStorage() {
  const { data } = await http.get<ApiResponse<UserPhotoStorageInfo>>('/users/me/storage');
  return data.data;
}

export async function fetchUserProfile() {
  const { data } = await http.get<ApiResponse<UserInfo>>('/users/me');
  return data.data;
}

export async function updateUserProfile(body: UpdateUserProfileRequest) {
  const { data } = await http.put<ApiResponse<UserInfo>>('/users/me', body);
  return data.data;
}

export async function uploadUserAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post<ApiResponse<UserInfo>>('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}
