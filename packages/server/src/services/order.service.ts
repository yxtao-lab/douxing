import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema/orders.js';
import {
  OrderStatus,
  OrderType,
  shouldAutoCompleteAfterPay,
  isOrderTerminalStatus,
} from '@douxing/shared';
import type { OrderInfo } from '@douxing/shared';
import { getRouteById, unlockRoute } from './route.service.js';
import { applyOrderStatusTransition } from './order-transition.service.js';
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

async function findUserOrder(orderId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createRouteUnlockOrder(userId: number, routeId: number) {
  const route = await getRouteById(routeId, userId);
  if (!route) return { error: '路线不存在' as const };

  const detail = route.routeDetail as Record<string, unknown> | null;
  if (detail?.isUnlocked === true) {
    return { error: '路线已解锁' as const };
  }

  const db = getDb();
  const pendingRows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.orderType, OrderType.ROUTE),
        eq(orders.productId, routeId),
        eq(orders.status, OrderStatus.PENDING),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (pendingRows[0]) {
    return { order: toOrderInfo(pendingRows[0]) };
  }

  const price = (detail?.unlockPrice as number) ?? 9.9;
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

/** MVP：模拟支付；状态机 pending → paid → completed */
export async function payOrder(orderId: number, userId: number) {
  const order = await findUserOrder(orderId, userId);
  if (!order) return { error: '订单不存在' as const };

  if (order.status === OrderStatus.PAID || order.status === OrderStatus.COMPLETED) {
    return { error: '订单已支付' as const };
  }
  if (isOrderTerminalStatus(order.status)) {
    return { error: '订单已关闭' as const };
  }
  if (order.status !== OrderStatus.PENDING) {
    return { error: '订单状态不可支付' as const };
  }

  const paid = await applyOrderStatusTransition(orderId, OrderStatus.PENDING, OrderStatus.PAID, {
    paidAt: new Date(),
  });
  if (!paid.updated) {
    return { error: '支付失败，订单状态已变更' as const };
  }

  if (order.orderType === OrderType.ROUTE) {
    await unlockRoute(order.productId, userId);
  }

  if (shouldAutoCompleteAfterPay(order.orderType)) {
    await applyOrderStatusTransition(orderId, OrderStatus.PAID, OrderStatus.COMPLETED);
  }

  const db = getDb();
  const updated = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return { order: toOrderInfo(updated[0]!) };
}

/** 用户取消待支付订单 */
export async function cancelOrder(orderId: number, userId: number) {
  const order = await findUserOrder(orderId, userId);
  if (!order) return { error: '订单不存在' as const };
  if (order.status !== OrderStatus.PENDING) {
    return { error: '仅待支付订单可取消' as const };
  }

  const result = await applyOrderStatusTransition(
    orderId,
    OrderStatus.PENDING,
    OrderStatus.CANCELLED,
  );
  if (!result.updated) {
    return { error: '取消失败，订单状态已变更' as const };
  }

  const db = getDb();
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
