import http from './http';
import type { ApiResponse, LoginResult } from '@douxing/shared';

export async function login(username: string, password: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/login', {
    username,
    password,
  });
  return data.data;
}

export async function register(username: string, password: string, nickname?: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/register', {
    username,
    password,
    nickname,
  });
  return data.data;
}

export async function sendSmsCode(phone: string) {
  const { data } = await http.post<ApiResponse<{ devCode?: string }>>('/auth/sms/send', {
    phone,
  });
  return data.data;
}

export async function smsLogin(phone: string, code: string) {
  const { data } = await http.post<ApiResponse<LoginResult>>('/auth/sms/login', {
    phone,
    code,
  });
  return data.data;
}
