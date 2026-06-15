import { eq, desc, and, count, or, like } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, membershipChangeLogs } from '../db/schema/index.js';
import {
  buildMembershipInfo,
  getPlanCandidateCountByMemberLevel,
  normalizeMemberLevel,
  getEffectiveMemberLevel,
  getMembershipProductById,
  getMembershipProductByLevel,
  MEMBERSHIP_PRODUCTS,
  MemberLevel,
  MembershipChangeSource,
  OrderType,
  type MembershipInfo,
  type MembershipProduct,
  type MembershipChangeLog,
  type AdminMembershipUserRow,
  type PaginatedResult,
  buildPaginatedResult,
  getMemberLevelLabel,
  ApiMessageKey,
} from '@douxing/shared';
import { getUserWithRoles } from './user.service.js';

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function mapChangeLogRow(
  row: typeof membershipChangeLogs.$inferSelect,
  extras?: { username?: string; nickname?: string; operatorName?: string | null },
): MembershipChangeLog {
  return {
    id: row.id,
    userId: row.userId,
    username: extras?.username,
    nickname: extras?.nickname,
    fromLevel: row.fromLevel,
    toLevel: row.toLevel,
    source: row.source,
    remark: row.remark ?? null,
    orderId: row.orderId ?? null,
    operatorId: row.operatorId ?? null,
    operatorName: extras?.operatorName ?? null,
    memberExpiresAt: toIso(row.memberExpiresAt),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getUserMemberLevel(userId: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ memberLevel: users.memberLevel, memberExpiresAt: users.memberExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) return MemberLevel.FREE;
  return getEffectiveMemberLevel(rows[0].memberLevel, rows[0].memberExpiresAt);
}

export async function getPlanCandidateCountForUser(userId: number): Promise<number> {
  const level = await getUserMemberLevel(userId);
  return getPlanCandidateCountByMemberLevel(level);
}

export async function getMembershipInfoForUser(userId: number): Promise<MembershipInfo | null> {
  const db = getDb();
  const rows = await db
    .select({ memberLevel: users.memberLevel, memberExpiresAt: users.memberExpiresAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) return null;
  return buildMembershipInfo(rows[0].memberLevel, {
    memberExpiresAt: rows[0].memberExpiresAt,
  });
}

export function listMembershipProducts(): MembershipProduct[] {
  return MEMBERSHIP_PRODUCTS;
}

export async function logMembershipChange(input: {
  userId: number;
  fromLevel: number;
  toLevel: number;
  source: string;
  remark?: string | null;
  orderId?: number | null;
  operatorId?: number | null;
  memberExpiresAt?: Date | null;
}) {
  const db = getDb();
  await db.insert(membershipChangeLogs).values({
    userId: input.userId,
    fromLevel: normalizeMemberLevel(input.fromLevel),
    toLevel: normalizeMemberLevel(input.toLevel),
    source: input.source,
    remark: input.remark ?? null,
    orderId: input.orderId ?? null,
    operatorId: input.operatorId ?? null,
    memberExpiresAt: input.memberExpiresAt ?? null,
  });
}

function computeNextExpiresAt(
  currentExpiresAt: Date | null | undefined,
  durationDays: number,
): Date {
  const base = currentExpiresAt && currentExpiresAt.getTime() > Date.now()
    ? currentExpiresAt
    : new Date();
  const next = new Date(base);
  next.setDate(next.getDate() + durationDays);
  return next;
}

export async function applyMembershipUpgrade(input: {
  userId: number;
  targetLevel: number;
  durationDays: number;
  source: string;
  remark?: string | null;
  orderId?: number | null;
  operatorId?: number | null;
}) {
  const db = getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const user = rows[0];
  if (!user) return { error: ApiMessageKey.USER_NOT_FOUND };

  const fromLevel = normalizeMemberLevel(user.memberLevel);
  const targetLevel = normalizeMemberLevel(input.targetLevel);
  const nextExpiresAt = computeNextExpiresAt(user.memberExpiresAt, input.durationDays);

  await db
    .update(users)
    .set({
      memberLevel: targetLevel,
      memberExpiresAt: targetLevel > MemberLevel.FREE ? nextExpiresAt : null,
    })
    .where(eq(users.id, input.userId));

  await logMembershipChange({
    userId: input.userId,
    fromLevel,
    toLevel: targetLevel,
    source: input.source,
    remark: input.remark ?? null,
    orderId: input.orderId ?? null,
    operatorId: input.operatorId ?? null,
    memberExpiresAt: targetLevel > MemberLevel.FREE ? nextExpiresAt : null,
  });

  const membership = await getMembershipInfoForUser(input.userId);
  return { membership };
}

export async function fulfillMembershipOrder(order: {
  id: number;
  userId: number;
  productId: number;
  productSnapshot: Record<string, unknown> | null;
}) {
  const snapshot = order.productSnapshot ?? {};
  const targetLevel = Number(snapshot.targetLevel ?? order.productId);
  const durationDays = Number(snapshot.durationDays ?? 30);
  const product = getMembershipProductById(order.productId) ?? getMembershipProductByLevel(targetLevel);
  if (!product) return { error: '会员套餐不存在' as const };

  return applyMembershipUpgrade({
    userId: order.userId,
    targetLevel: product.targetLevel,
    durationDays: product.durationDays ?? durationDays,
    source: MembershipChangeSource.PURCHASE,
    remark: `订单 #${order.id} 支付履约`,
    orderId: order.id,
  });
}

export async function listUserMembershipLogsPaginated(
  userId: number,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<MembershipChangeLog>> {
  const db = getDb();
  const where = eq(membershipChangeLogs.userId, userId);
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(membershipChangeLogs)
    .where(where);
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(membershipChangeLogs)
    .where(where)
    .orderBy(desc(membershipChangeLogs.createdAt))
    .limit(pageSize)
    .offset(offset);
  return buildPaginatedResult(rows.map((row) => mapChangeLogRow(row)), Number(total ?? 0), page, pageSize);
}

export async function listMembershipLogsForAdminPaginated(
  page: number,
  pageSize: number,
  filters?: { userId?: number; source?: string; keyword?: string },
): Promise<PaginatedResult<MembershipChangeLog>> {
  const db = getDb();
  const conditions = [];
  if (filters?.userId) {
    conditions.push(eq(membershipChangeLogs.userId, filters.userId));
  }
  if (filters?.source) {
    conditions.push(eq(membershipChangeLogs.source, filters.source));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(users.username, `%${filters.keyword}%`),
        like(users.nickname, `%${filters.keyword}%`),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const baseQuery = db
    .select({ log: membershipChangeLogs, user: users })
    .from(membershipChangeLogs)
    .innerJoin(users, eq(membershipChangeLogs.userId, users.id));
  const countQuery = db
    .select({ value: count() })
    .from(membershipChangeLogs)
    .innerJoin(users, eq(membershipChangeLogs.userId, users.id));

  const [{ value: total }] = where
    ? await countQuery.where(where)
    : await countQuery;
  const offset = (page - 1) * pageSize;
  const rows = where
    ? await baseQuery.where(where).orderBy(desc(membershipChangeLogs.createdAt)).limit(pageSize).offset(offset)
    : await baseQuery.orderBy(desc(membershipChangeLogs.createdAt)).limit(pageSize).offset(offset);

  const items = await Promise.all(
    rows.map(async (row) => {
      let operatorName: string | null = null;
      if (row.log.operatorId) {
        const op = await getUserWithRoles(row.log.operatorId);
        operatorName = op?.nickname || op?.username || null;
      }
      return mapChangeLogRow(row.log, {
        username: row.user.username,
        nickname: row.user.nickname,
        operatorName,
      });
    }),
  );
  return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
}

export async function listMembershipUsersForAdminPaginated(
  page: number,
  pageSize: number,
  filters?: { level?: number; keyword?: string },
): Promise<PaginatedResult<AdminMembershipUserRow>> {
  const db = getDb();
  const conditions = [];
  if (filters?.level != null && Number.isFinite(filters.level)) {
    conditions.push(eq(users.memberLevel, Math.trunc(filters.level)));
  }
  if (filters?.keyword) {
    conditions.push(
      or(
        like(users.username, `%${filters.keyword}%`),
        like(users.nickname, `%${filters.keyword}%`),
        like(users.phone, `%${filters.keyword}%`),
      )!,
    );
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ value: total }] = where
    ? await db.select({ value: count() }).from(users).where(where)
    : await db.select({ value: count() }).from(users);
  const offset = (page - 1) * pageSize;
  const rows = where
    ? await db.select().from(users).where(where).orderBy(desc(users.id)).limit(pageSize).offset(offset)
    : await db.select().from(users).orderBy(desc(users.id)).limit(pageSize).offset(offset);

  const items: AdminMembershipUserRow[] = rows.map((row) => {
    const memberLevel = normalizeMemberLevel(row.memberLevel);
    const memberExpiresAt = toIso(row.memberExpiresAt);
    const effectiveLevel = getEffectiveMemberLevel(memberLevel, row.memberExpiresAt);
    const isExpired =
      memberLevel > MemberLevel.FREE &&
      memberExpiresAt != null &&
      new Date(memberExpiresAt).getTime() <= Date.now();
    return {
      id: row.id,
      username: row.username,
      nickname: row.nickname,
      phone: row.phone,
      memberLevel,
      effectiveLevel,
      memberExpiresAt,
      isExpired,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  });
  return buildPaginatedResult(items, Number(total ?? 0), page, pageSize);
}

export async function updateMembershipByAdmin(input: {
  userId: number;
  memberLevel: number;
  memberExpiresAt?: string | null;
  remark?: string | null;
  operatorId: number;
}) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  const user = rows[0];
  if (!user) return { error: ApiMessageKey.USER_NOT_FOUND };

  const fromLevel = normalizeMemberLevel(user.memberLevel);
  const toLevel = normalizeMemberLevel(input.memberLevel);
  let expiresAt: Date | null = null;
  if (toLevel > MemberLevel.FREE) {
    if (input.memberExpiresAt) {
      expiresAt = new Date(input.memberExpiresAt);
      if (Number.isNaN(expiresAt.getTime())) {
        return { error: ApiMessageKey.PARAM_ERROR };
      }
    } else {
      expiresAt = computeNextExpiresAt(user.memberExpiresAt, 30);
    }
  }

  await db
    .update(users)
    .set({
      memberLevel: toLevel,
      memberExpiresAt: expiresAt,
    })
    .where(eq(users.id, input.userId));

  await logMembershipChange({
    userId: input.userId,
    fromLevel,
    toLevel,
    source: MembershipChangeSource.ADMIN,
    remark: input.remark ?? `管理员调整为 ${getMemberLevelLabel(toLevel)}`,
    operatorId: input.operatorId,
    memberExpiresAt: expiresAt,
  });

  const membership = await getMembershipInfoForUser(input.userId);
  return { membership };
}

export function validateMembershipPurchase(
  currentLevel: number,
  targetLevel: number,
): { error?: string } {
  const current = normalizeMemberLevel(currentLevel);
  const target = normalizeMemberLevel(targetLevel);
  if (target <= MemberLevel.FREE) {
    return { error: ApiMessageKey.MEMBERSHIP_PRODUCT_NOT_FOUND };
  }
  if (target < current) {
    return { error: ApiMessageKey.MEMBERSHIP_DOWNGRADE_NOT_ALLOWED };
  }
  if (!getMembershipProductByLevel(target)) {
    return { error: ApiMessageKey.MEMBERSHIP_PRODUCT_NOT_FOUND };
  }
  return {};
}

export function buildMembershipOrderProductName(targetLevel: number): string {
  return `会员升级：${getMemberLevelLabel(targetLevel)}`;
}

export function getMembershipOrderType(): string {
  return OrderType.MEMBERSHIP;
}
