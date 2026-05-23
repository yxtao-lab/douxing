import type { UserInfo } from '@douxing/shared';

const TOKEN_KEY = 'douxing_token';
const USER_KEY = 'douxing_user';

/** 读取本地登录用户（无 request 依赖，避免小程序生产包模块循环/压缩冲突） */
export function getStoredUser(): UserInfo | null {
  try {
    const raw = uni.getStorageSync(USER_KEY);
    return raw ? (JSON.parse(raw) as UserInfo) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string {
  return (uni.getStorageSync(TOKEN_KEY) as string) || '';
}

export function setAuth(token: string, user: UserInfo) {
  uni.setStorageSync(TOKEN_KEY, token);
  uni.setStorageSync(USER_KEY, JSON.stringify(user));
}

export { TOKEN_KEY, USER_KEY };
