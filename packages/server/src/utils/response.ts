import type { Request, Response } from 'express';
import type { ApiResponse } from '@douxing/shared';
import {
  API_LEGACY_MESSAGE_MAP,
  ApiMessageKey,
  DEFAULT_LOCALE,
  isApiError,
  isApiMessageKey,
  resolveApiMessageInput,
  type ApiMessageKeyType,
  type ApiMessageParams,
  type LocaleCode,
} from '@douxing/shared';

function getResponseLocale(res: Response): LocaleCode {
  return res.locals.locale ?? DEFAULT_LOCALE;
}

function resolveOutgoingMessage(
  res: Response,
  messageOrKey: string,
  params?: ApiMessageParams,
): { message: string; messageKey?: ApiMessageKeyType } {
  const locale = getResponseLocale(res);
  return resolveApiMessageInput(messageOrKey, locale, params, API_LEGACY_MESSAGE_MAP);
}

export function success<T>(
  res: Response,
  data: T,
  messageOrKey: string = ApiMessageKey.OK,
  params?: ApiMessageParams,
) {
  const { message, messageKey } = resolveOutgoingMessage(res, messageOrKey, params);
  const body: ApiResponse<T> = { code: 0, message, data };
  if (messageKey) body.messageKey = messageKey;
  res.json(body);
}

export function fail(
  res: Response,
  messageOrKey: string,
  code = 1,
  status = 400,
  params?: ApiMessageParams,
) {
  const { message, messageKey } = resolveOutgoingMessage(res, messageOrKey, params);
  const body: ApiResponse<null> = { code, message, data: null };
  if (messageKey) body.messageKey = messageKey;
  res.status(status).json(body);
}

/** 捕获 ApiError 或普通 Error 并返回 fail */
export function failFromError(
  res: Response,
  err: unknown,
  fallbackKey: ApiMessageKeyType = ApiMessageKey.SERVER_ERROR,
) {
  if (isApiError(err)) {
    return fail(res, err.messageKey, 1, 400, err.params);
  }
  const message = err instanceof Error ? err.message : fallbackKey;
  if (isApiMessageKey(message)) {
    return fail(res, message);
  }
  return fail(res, message);
}

export function failValidation(res: Response, _req?: Request) {
  return fail(res, ApiMessageKey.VALIDATION_ERROR);
}
