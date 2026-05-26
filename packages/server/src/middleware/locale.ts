import type { Request, Response, NextFunction } from 'express';
import { DEFAULT_LOCALE, getLocaleFromAcceptLanguage, type LocaleCode } from '@douxing/shared';

declare global {
  namespace Express {
    interface Locals {
      locale?: LocaleCode;
    }
  }
}

export function localeMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers['accept-language'];
  const acceptLanguage = Array.isArray(header) ? header[0] : header;
  res.locals.locale = getLocaleFromAcceptLanguage(acceptLanguage ?? null);
  if (!res.locals.locale) {
    res.locals.locale = DEFAULT_LOCALE;
  }
  next();
}
