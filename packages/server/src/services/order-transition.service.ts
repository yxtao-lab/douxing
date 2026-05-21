import { and, eq } from 'drizzle-orm';
import { canTransitionOrderStatus } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema/orders.js';

export type OrderTransitionPatch = {
  paidAt?: Date;
};

/**
 * 乐观锁式状态流转：仅当当前 status === expectedFrom 时更新。
 * 返回 updated 表示是否成功写入目标状态。
 */
export async function applyOrderStatusTransition(
  orderId: number,
  expectedFrom: number,
  to: number,
  patch: OrderTransitionPatch = {},
): Promise<{ updated: boolean }> {
  if (!canTransitionOrderStatus(expectedFrom, to)) {
    return { updated: false };
  }

  const db = getDb();
  const set: Partial<typeof orders.$inferInsert> = { status: to };
  if (patch.paidAt) set.paidAt = patch.paidAt;

  await db
    .update(orders)
    .set(set)
    .where(and(eq(orders.id, orderId), eq(orders.status, expectedFrom)));

  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return { updated: rows[0]?.status === to };
}
