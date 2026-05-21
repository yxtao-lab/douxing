import { ORDER_PENDING_TIMEOUT_MINUTES_DEFAULT } from '@douxing/shared';

export function getOrderPendingTimeoutMs(): number {
  const raw = process.env.ORDER_PENDING_TIMEOUT_MINUTES;
  if (!raw) return ORDER_PENDING_TIMEOUT_MINUTES_DEFAULT * 60 * 1000;
  const minutes = parseInt(raw, 10);
  if (Number.isNaN(minutes) || minutes <= 0) {
    return ORDER_PENDING_TIMEOUT_MINUTES_DEFAULT * 60 * 1000;
  }
  return minutes * 60 * 1000;
}

/** 超时扫描间隔（毫秒），默认 60 秒 */
export function getOrderTimeoutScanIntervalMs(): number {
  const raw = process.env.ORDER_TIMEOUT_SCAN_INTERVAL_SEC;
  if (!raw) return 60_000;
  const sec = parseInt(raw, 10);
  if (Number.isNaN(sec) || sec < 10) return 60_000;
  return sec * 1000;
}
