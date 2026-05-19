import http from './http';
import type { ApiResponse, LoginResult } from '@douxing/shared';

export async function login(username: string, password: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/login', {
    username,
    password,
  });
  return data.data;
}
