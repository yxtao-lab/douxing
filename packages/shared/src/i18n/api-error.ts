import type { ApiMessageKeyType } from './api-keys.js';
import type { ApiMessageParams } from './resolve-api-message.js';

/** 业务层可抛出的国际化错误（由响应工具转换为 API message） */
export class ApiError extends Error {
  readonly messageKey: ApiMessageKeyType;
  readonly params?: ApiMessageParams;

  constructor(messageKey: ApiMessageKeyType, params?: ApiMessageParams) {
    super(messageKey);
    this.name = 'ApiError';
    this.messageKey = messageKey;
    this.params = params;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
