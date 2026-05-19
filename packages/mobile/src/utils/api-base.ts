/**
 * H5 开发可走 Vite 代理（/api）；
 * 微信小程序必须使用完整 URL，并在公众平台配置 request 合法域名。
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (fromEnv?.trim()) {
    return fromEnv.trim().replace(/\/$/, '');
  }

  const platform = import.meta.env.UNI_PLATFORM as string | undefined;

  if (platform === 'h5') {
    return '/api';
  }

  if (platform === 'mp-weixin') {
    console.warn(
      '[兜行] 未配置 VITE_API_BASE_URL，开发默认 http://127.0.0.1:3000/api（需开发者工具关闭域名校验）',
    );
    return 'http://127.0.0.1:3000/api';
  }

  return '/api';
}
