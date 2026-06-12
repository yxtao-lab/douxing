/** 本地开发默认管理员口令（仅 NODE_ENV !== production 且未设 ADMIN_INITIAL_PASSWORD 时使用） */
export const DEV_DEFAULT_ADMIN_PASSWORD = 'admin123';

export const ADMIN_PASSWORD_MIN_LENGTH = 12;

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function readAdminInitialUsername(): string {
  return process.env.ADMIN_INITIAL_USERNAME?.trim() || 'admin';
}

export function readAdminInitialPassword(): string | undefined {
  const value = process.env.ADMIN_INITIAL_PASSWORD?.trim();
  return value || undefined;
}

/** 校验生产级管理员密码；通过返回 null，否则返回中文错误说明 */
export function validateAdminPassword(password: string): string | null {
  if (password.length < ADMIN_PASSWORD_MIN_LENGTH) {
    return `密码至少 ${ADMIN_PASSWORD_MIN_LENGTH} 位`;
  }
  if (!/[a-z]/.test(password)) return '密码须包含小写字母';
  if (!/[A-Z]/.test(password)) return '密码须包含大写字母';
  if (!/[0-9]/.test(password)) return '密码须包含数字';
  return null;
}
