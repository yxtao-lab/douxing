/** 客户端本地存储：Access Token */
export const AUTH_TOKEN_KEY = 'douxing_token';
/** 客户端本地存储：Refresh Token */
export const AUTH_REFRESH_TOKEN_KEY = 'douxing_refresh_token';
/** 客户端本地存储：当前用户信息 JSON */
export const AUTH_USER_KEY = 'douxing_user';

/**
 * 创建单例 token 刷新协调器，避免并发 401 时重复请求 /auth/refresh。
 *
 * @param refreshFn - 执行刷新并返回新 access token；失败时返回 `null`
 * @returns 带 single-flight 的刷新函数
 */
export function createTokenRefreshCoordinator(
  refreshFn: () => Promise<string | null>,
): () => Promise<string | null> {
  let inflight: Promise<string | null> | null = null;

  return async (): Promise<string | null> => {
    if (!inflight) {
      inflight = refreshFn().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  };
}
