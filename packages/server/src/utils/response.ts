import type { Response } from 'express';
import type { ApiResponse } from '@douxing/shared';

export function success<T>(res: Response, data: T, message = 'ok') {
  const body: ApiResponse<T> = { code: 0, message, data };
  res.json(body);
}

export function fail(res: Response, message: string, code = 1, status = 400) {
  const body: ApiResponse<null> = { code, message, data: null };
  res.status(status).json(body);
}
