import {
  ApiError,
  ApiMessageKey,
  MarketplaceNotificationRefType,
  MarketplaceNotificationType,
  type MarketplaceNotificationSummary,
} from '@douxing/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../db/client.js';
import { marketplaceNotification } from '../../db/schema/marketplace-notification.js';

/**
 * 将通知表行映射为 API 摘要。
 *
 * @param row - `marketplace_notification` 行
 * @returns 通知摘要 DTO
 */
function toNotificationSummary(
  row: typeof marketplaceNotification.$inferSelect,
): MarketplaceNotificationSummary {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as MarketplaceNotificationSummary['type'],
    refType: row.refType as MarketplaceNotificationSummary['refType'],
    refId: row.refId,
    messageKey: row.messageKey,
    payload: row.payload ?? null,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 为匹配到的服务者批量写入「新需求匹配」站内通知（已存在同需求记录则跳过）。
 *
 * @param items - 待通知列表（userId + 需求信息）
 * @returns 实际新插入条数
 */
export async function createDemandMatchNotifications(
  items: Array<{ userId: number; demandId: number; title: string; score: number }>,
): Promise<number> {
  if (items.length === 0) return 0;

  const db = getDb();
  let inserted = 0;

  for (const item of items) {
    const existing = await db
      .select({ id: marketplaceNotification.id })
      .from(marketplaceNotification)
      .where(
        and(
          eq(marketplaceNotification.userId, item.userId),
          eq(marketplaceNotification.type, MarketplaceNotificationType.DEMAND_MATCH),
          eq(marketplaceNotification.refType, MarketplaceNotificationRefType.SERVICE_DEMAND),
          eq(marketplaceNotification.refId, item.demandId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      continue;
    }

    await db.insert(marketplaceNotification).values({
      userId: item.userId,
      type: MarketplaceNotificationType.DEMAND_MATCH,
      refType: MarketplaceNotificationRefType.SERVICE_DEMAND,
      refId: item.demandId,
      messageKey: ApiMessageKey.MARKETPLACE_DEMAND_MATCHED,
      payload: {
        title: item.title,
        demandId: item.demandId,
        score: item.score,
      },
    });
    inserted += 1;
  }

  return inserted;
}

/**
 * 列出当前用户的站内通知（默认全部，可只取未读）。
 *
 * @param userId - 用户 ID
 * @param options - `unreadOnly` 为 true 时仅未读；`limit` 默认 50
 * @returns 按创建时间倒序的通知列表；无记录为空数组
 */
export async function listNotificationsForUser(
  userId: number,
  options?: { unreadOnly?: boolean; limit?: number },
): Promise<MarketplaceNotificationSummary[]> {
  const db = getDb();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const conditions = [eq(marketplaceNotification.userId, userId)];
  if (options?.unreadOnly) {
    conditions.push(isNull(marketplaceNotification.readAt));
  }

  const rows = await db
    .select()
    .from(marketplaceNotification)
    .where(and(...conditions))
    .orderBy(desc(marketplaceNotification.createdAt))
    .limit(limit);

  return rows.map(toNotificationSummary);
}

/**
 * 将指定通知标记为已读（须属于当前用户）。
 *
 * @param notificationId - 通知 ID
 * @param userId - 当前用户 ID
 * @returns 更新后的通知摘要
 * @throws {ApiError} 不存在或不属于当前用户
 */
export async function markNotificationRead(
  notificationId: number,
  userId: number,
): Promise<MarketplaceNotificationSummary> {
  const db = getDb();
  const rows = await db
    .select()
    .from(marketplaceNotification)
    .where(
      and(eq(marketplaceNotification.id, notificationId), eq(marketplaceNotification.userId, userId)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_NOTIFICATION_NOT_FOUND);
  }

  if (!row.readAt) {
    await db
      .update(marketplaceNotification)
      .set({ readAt: new Date() })
      .where(eq(marketplaceNotification.id, notificationId));
  }

  const updated = await db
    .select()
    .from(marketplaceNotification)
    .where(eq(marketplaceNotification.id, notificationId))
    .limit(1);
  return toNotificationSummary(updated[0]!);
}

/**
 * 统计指定用户对某需求的匹配通知条数（验收用）。
 *
 * @param userId - 服务方用户 ID
 * @param demandId - 需求 ID
 * @returns 通知条数；无则为 0
 */
export async function countDemandMatchNotifications(
  userId: number,
  demandId: number,
): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ id: marketplaceNotification.id })
    .from(marketplaceNotification)
    .where(
      and(
        eq(marketplaceNotification.userId, userId),
        eq(marketplaceNotification.type, MarketplaceNotificationType.DEMAND_MATCH),
        eq(marketplaceNotification.refType, MarketplaceNotificationRefType.SERVICE_DEMAND),
        eq(marketplaceNotification.refId, demandId),
      ),
    );
  return rows.length;
}
