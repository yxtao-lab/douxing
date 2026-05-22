/** 打卡业务校验错误（返回 400） */
export class CheckinValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckinValidationError';
  }
}

export function isCheckinValidationError(err: unknown): err is CheckinValidationError {
  return err instanceof CheckinValidationError;
}
