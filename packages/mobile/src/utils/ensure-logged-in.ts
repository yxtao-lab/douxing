import type { UserInfo } from '@douxing/shared';
import { getStoredUser } from './auth-storage';

/** 独立模块，避免 plan 页生产包压缩后与 await 结果变量同名冲突 */
export function ensureLoggedInUser(): UserInfo | null {
  return getStoredUser();
}
