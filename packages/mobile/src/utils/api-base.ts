/**
 * H5 开发可走 Vite 代理（/api）；
 * 微信小程序 / App 真机必须使用完整 HTTPS URL，并在公众平台配置合法域名。
 */
const platform = import.meta.env.UNI_PLATFORM as string | undefined;
const buildMode = import.meta.env.MODE;

function isLocalHostBase(base: string): boolean {
  return /^(https?:\/\/)?(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/i.test(base.trim());
}

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  if (platform === 'h5') {
    return '/api';
  }

  if (platform === 'mp-weixin' || platform === 'app' || platform?.startsWith('app-')) {
    if (buildMode === 'production') {
      console.error(
        '[兜行] 生产包缺少 VITE_API_BASE_URL，请检查 .env.production 并重新 pnpm build:mp-weixin',
      );
    } else if (buildMode === 'staging') {
      console.error(
        '[兜行] 测试包缺少 VITE_API_BASE_URL，请检查 .env.staging 并重新 pnpm build:mp-weixin:staging',
      );
    } else {
      console.warn(
        '[兜行] 未配置 VITE_API_BASE_URL，开发默认 127.0.0.1（仅模拟器可用；真机请在 .env.local 配置局域网 IP）',
      );
    }
    return 'http://127.0.0.1:3000/api';
  }

  return '/api';
}

/** 真机 uploadFile / 非本地 API 场景调用，本地地址直接拒绝并提示 */
export function assertRemoteApiBase(action = '上传文件'): void {
  const base = getApiBaseUrl();
  if (isLocalHostBase(base)) {
    throw new Error(
      `${action}失败：当前 API 为 ${base}，手机无法访问本机。` +
        '请执行 pnpm build:mp-weixin 导入生产包，或在 .env.local 配置 HTTPS 域名后重新 pnpm dev:mp-weixin',
    );
  }
  if (!/^https:\/\//i.test(base)) {
    throw new Error(`${action}失败：小程序真机须使用 HTTPS API（当前 ${base}）`);
  }
}

export function isLocalApiBase(): boolean {
  return isLocalHostBase(getApiBaseUrl());
}
