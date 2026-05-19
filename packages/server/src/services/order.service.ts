import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema/orders.js';
import { OrderStatus, OrderType } from '@douxing/shared';
import type { OrderInfo } from '@douxing/shared';
import { getRouteById, unlockRoute } from './route.service.js';
import { randomBytes } from 'crypto';

function generateOrderNo(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `DX${ts}${rand}`;
}

function toOrderInfo(row: typeof orders.$inferSelect): OrderInfo {
  return {
    id: row.id,
    orderNo: row.orderNo,
    userId: row.userId,
    orderType: row.orderType,
    productId: row.productId,
    productName: row.productName,
    totalAmount: String(row.totalAmount),
    status: row.status,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createRouteUnlockOrder(userId: number, routeId: number) {
  const route = await getRouteById(routeId, userId);
  if (!route) return { error: '路线不存在' as const };

  const detail = route.routeDetail as Record<string, unknown> | null;
  if (detail?.isUnlocked === true) {
    return { error: '路线已解锁' as const };
  }

  const price = (detail?.unlockPrice as number) ?? 9.9;

  const db = getDb();
  const orderNo = generateOrderNo();
  const [result] = await db.insert(orders).values({
    orderNo,
    userId,
    orderType: OrderType.ROUTE,
    productId: routeId,
    productName: `解锁路线：${route.name}`,
    totalAmount: String(price),
    status: OrderStatus.PENDING,
    productSnapshot: { routeId, routeName: route.name, unlockPrice: price },
  });

  const id = Number(result.insertId);
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return { order: toOrderInfo(rows[0]!) };
}

/** MVP：模拟支付成功 */
export async function payOrder(orderId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  const order = rows[0];
  if (!order) return { error: '订单不存在' as const };
  if (order.status !== OrderStatus.PENDING) {
    return { error: '订单状态不可支付' as const };
  }

  await db
    .update(orders)
    .set({ status: OrderStatus.PAID, paidAt: new Date() })
    .where(eq(orders.id, orderId));

  if (order.orderType === OrderType.ROUTE) {
    await unlockRoute(order.productId, userId);
  }

  const updated = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return { order: toOrderInfo(updated[0]!) };
}

export async function listUserOrders(userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  return rows.map(toOrderInfo);
}

export async function listAllOrdersForAdmin() {
  const db = getDb();
  const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(100);
  return rows.map(toOrderInfo);
}
