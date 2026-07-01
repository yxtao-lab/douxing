/** 本地开发默认 PC 用户端 Vite 端口 */
const DEFAULT_PC_DEV_URL = 'http://localhost:5176';

/**
 * 解析 PC 用户端根地址，供管理端工作台外链跳转。
 * 优先读取构建时 `VITE_PC_BASE_URL`；开发环境回退 `localhost:5176`；生产未配置时回退当前页同源。
 *
 * @returns 无尾部斜杠的 PC 用户端根 URL
 */
export function getPcClientUrl(): string {
  const envBase = import.meta.env.VITE_PC_BASE_URL?.trim().replace(/\/$/, '');
  if (envBase) return envBase;
  if (import.meta.env.DEV) return DEFAULT_PC_DEV_URL;
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return DEFAULT_PC_DEV_URL;
}
