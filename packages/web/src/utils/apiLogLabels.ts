import type { ApiLogRow } from '@/api/system';

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/**
 * 格式化接口日志模块名称。
 */
export function formatApiLogModule(t: TranslateFn, moduleKey: string): string {
  const key = `apiLog.module.${moduleKey}`;
  const label = t(key);
  return label === key ? moduleKey : label;
}

export type ApiLogModuleRecord = Pick<ApiLogRow, 'apiModuleKey'>;
