import { z } from 'zod';

/** Express query 中的可选整数：空字符串不当作 0 */
export function optionalQueryInt(min: number, max: number) {
  return z.preprocess((value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }, z.number().int().min(min).max(max).optional());
}
