import { eq, desc, and, count, or } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { orders } from '../db/schema/orders.js';
import type { OrderInfo, OrderListTab, PaginatedResult } from '@douxing/shared';
import {
  OrderStatus,
  OrderType,
  shouldAutoCompleteAfterPay,
  isOrderTerminalStatus,
  buildPaginatedResult,
  getMembershipProductByLevel,
} from '@douxing/shared';
import { getRouteById, unlockRoute } from './route.service.js';
import { applyOrderStatusTransition } from './order-transition.service.js';
import { isRouteUnlockPaymentRequired } from '../config/route-unlock.js';
import { randomBytes } from 'crypto';
import {
  buildMembershipOrderProductName,
  validateMembershipPurchase,
  fulfillMembershipOrder,
  getUserMemberLevel,
} from './membership.service.js';

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

export async function findUserOrder(orderId: number, userId: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrderByOrderNo(orderNo: string) {
  const db = getDb();
  const rows = await db.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1);
  return rows[0] ?? null;
}

export async function getOrderById(orderId: number, userId: number) {
  const order = await findUserOrder(orderId, userId);
  if (!order) return { error: '订单不存在' as const };
  return { order: toOrderInfo(order) };
}

/** 支付成功后的履约（模拟支付 / 微信回调共用） */
export async function fulfillOrderAfterPaid(orderId: number) {
  const db = getDb();
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order) return { error: '订单不存在' as const };

  if (order.status === OrderStatus.COMPLETED) {
    return { order: toOrderInfo(order) };
  }
  if (order.status === OrderStatus.CANCELLED) {
    return { error: '订单已取消' as const };
  }

  if (order.status === OrderStatus.PENDING) {
    const paid = await applyOrderStatusTransition(orderId, OrderStatus.PENDING, OrderStatus.PAID, {
      paidAt: new Date(),
    });
    if (!paid.updated) {
      const refreshed = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      const cur = refreshed[0];
      if (!cur || (cur.status !== OrderStatus.PAID && cur.status !== OrderStatus.COMPLETED)) {
        return { error: '支付确认失败，订单状态已变更' as const };
      }
    }
  }

  const currentRows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const current = currentRows[0]!;

  if (current.orderType === OrderType.ROUTE && current.status === OrderStatus.PAID) {
    await unlockRoute(current.productId, current.userId);
  }

  if (current.orderType === OrderType.MEMBERSHIP && current.status === OrderStatus.PAID) {
    const upgrade = await fulfillMembershipOrder({
      id: current.id,
      userId: current.userId,
      productId: current.productId,
      productSnapshot: (current.productSnapshot as Record<string, unknown> | null) ?? null,
    });
    if ('error' in upgrade) {
      return { error: upgrade.error ?? '会员履约失败' as const };
    }
  }

  if (shouldAutoCompleteAfterPay(current.orderType) && current.status === OrderStatus.PAID) {
    await applyOrderStatusTransition(orderId, OrderStatus.PAID, OrderStatus.COMPLETED);
  }

  const updated = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  return { order: toOrderInfo(updated[0]!) };
}

export async function createRouteUnlockOrder(userId: number, routeId: number) {
  if (!isRouteUnlockPaymentRequired()) {
    return { error: '当前无需支付即可查看路线' as const };
  }

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

export async function createMembershipUpgradeOrder(userId: number, targetLevel: number) {
  const product = getMembershipProductByLevel(targetLevel);
  if (!product) return { error: '会员套餐不存在' as const };

  const currentLevel = await getUserMemberLevel(userId);
  const validation = validateMembershipPurchase(currentLevel, targetLevel);
  if (validation.error) return { error: validation.error };

  const db = getDb();
  const pendingRows = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.orderType, OrderType.MEMBERSHIP),
        eq(orders.productId, product.id),
        eq(orders.status, OrderStatus.PENDING),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);
  if (pendingRows[0]) {
    return { order: toOrderInfo(pendingRows[0]) };
  }

  const orderNo = generateOrderNo();
  const productName = buildMembershipOrderProductName(product.targetLevel);
  const [result] = await db.insert(orders).values({
    orderNo,
    userId,
    orderType: OrderType.MEMBERSHIP,
    productId: product.id,
    productName,
    totalAmount: String(product.price),
    status: OrderStatus.PENDING,
    productSnapshot: {
      targetLevel: product.targetLevel,
      durationDays: product.durationDays,
      price: product.price,
    },
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

  return fulfillOrderAfterPaid(orderId);
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

function buildUserOrderWhere(userId: number, tab: OrderListTab = 'all') {
  const conditions = [eq(orders.userId, userId)];
  if (tab === 'pending') {
    conditions.push(eq(orders.status, OrderStatus.PENDING));
  } else if (tab === 'done') {
    conditions.push(
      or(eq(orders.status, OrderStatus.PAID), eq(orders.status, OrderStatus.COMPLETED))!,
    );
  }
  return and(...conditions);
}

async function paginateOrders(
  where: ReturnType<typeof and> | undefined,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<OrderInfo>> {
  const db = getDb();
  const [{ value: total }] = await db.select({ value: count() }).from(orders).where(where);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset(offset);
  return buildPaginatedResult(rows.map(toOrderInfo), Number(total ?? 0), page, pageSize);
}

export async function listUserOrdersPaginated(
  userId: number,
  page: number,
  pageSize: number,
  tab: OrderListTab = 'all',
) {
  return paginateOrders(buildUserOrderWhere(userId, tab), page, pageSize);
}

export async function listAllOrdersForAdminPaginated(page: number, pageSize: number) {
  return paginateOrders(undefined, page, pageSize);
}
