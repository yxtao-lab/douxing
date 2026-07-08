import { AsyncLocalStorage } from 'node:async_hooks';

interface ExternalApiCounterState {
  count: number;
}

const storage = new AsyncLocalStorage<ExternalApiCounterState>();

/**
 * 记录一次外部 HTTP API 调用（如高德 geocode / distance）。
 * 仅在 {@link runWithExternalApiCounter} 作用域内生效。
 */
export function recordExternalApiCall(): void {
  const state = storage.getStore();
  if (state) {
    state.count += 1;
  }
}

/**
 * 在独立计数作用域内执行异步任务，返回结果与外部 API 调用次数。
 *
 * @param fn - 业务逻辑（如 enrichRouteDraft）
 * @returns `result` 与 `externalApiCalls` 计数
 */
export async function runWithExternalApiCounter<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; externalApiCalls: number }> {
  const state: ExternalApiCounterState = { count: 0 };
  const result = await storage.run(state, fn);
  return { result, externalApiCalls: state.count };
}

/**
 * 读取当前作用域内已记录的外部 API 调用次数；无作用域时返回 0。
 *
 * @returns 调用次数
 */
export function getCurrentExternalApiCallCount(): number {
  return storage.getStore()?.count ?? 0;
}
