import { and, eq, lt } from 'drizzle-orm';
import { OrderStatus } from '@douxing/shared';
import { getOrderPendingTimeoutMs, getOrderTimeoutScanIntervalMs } from '../config/order.js';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema/orders.js';
import { applyOrderStatusTransition } from '../services/order-transition.service.js';

let timer: ReturnType<typeof setInterval> | undefined;

async function cancelExpiredPendingOrders(): Promise<number> {
  const db = getDb();
  const cutoff = new Date(Date.now() - getOrderPendingTimeoutMs());
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, OrderStatus.PENDING), lt(orders.createdAt, cutoff)));

  let cancelled = 0;
  for (const row of stale) {
    const { updated } = await applyOrderStatusTransition(
      row.id,
      OrderStatus.PENDING,
      OrderStatus.CANCELLED,
    );
    if (updated) cancelled += 1;
  }
  if (cancelled > 0) {
    console.log(`[order-timeout] 已自动取消 ${cancelled} 笔超时待支付订单`);
  }
  return cancelled;
}

export function startOrderTimeoutJob(): void {
  if (timer) return;
  const intervalMs = getOrderTimeoutScanIntervalMs();
  void cancelExpiredPendingOrders();
  timer = setInterval(() => {
    void cancelExpiredPendingOrders().catch((err) => {
      console.error('[order-timeout] 扫描失败', err);
    });
  }, intervalMs);
  console.log(`[order-timeout] 待支付超时扫描已启动（间隔 ${intervalMs / 1000}s）`);
}
