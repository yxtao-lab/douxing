import { and, asc, eq, ne } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  GroupMemberRole,
  isValidDemandGroupType,
  type DemandGroupDetail,
  type DemandGroupInput,
  type DemandGroupSummary,
  type GroupMemberRoleValue,
  type GroupMemberSummary,
  type GroupMembershipSummary,
  type InviteGroupMemberInput,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { demandGroup, groupMember } from '../../db/schema/marketplace-demand.js';
import { users } from '../../db/schema/users.js';

/**
 * 将团体行映射为 API 摘要 DTO。
 *
 * @param row - `demand_group` 表行
 * @returns 团体摘要
 */
function toDemandGroupSummary(row: typeof demandGroup.$inferSelect): DemandGroupSummary {
  return {
    id: row.id,
    name: row.name,
    groupType: row.groupType as DemandGroupSummary['groupType'],
    headcount: row.headcount ?? null,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * 将成员行与用户信息映射为 API 摘要 DTO。
 *
 * @param row - `group_member` 表行
 * @param user - 关联用户行；缺失时昵称/用户名为 null
 * @returns 团体成员摘要
 */
function toGroupMemberSummary(
  row: typeof groupMember.$inferSelect,
  user?: { nickname: string | null; username: string } | null,
): GroupMemberSummary {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    memberRole: row.memberRole as GroupMemberSummary['memberRole'],
    nickname: user?.nickname ?? null,
    username: user?.username ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 校验创建/更新团体入参。
 *
 * @param input - 团体表单
 * @throws {ApiError} 字段无效时抛出 `MARKETPLACE_GROUP_INVALID`
 */
function validateDemandGroupInput(input: DemandGroupInput): void {
  if (!input.name?.trim() || input.name.trim().length > 128) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_INVALID);
  }
  if (!isValidDemandGroupType(input.groupType)) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_INVALID);
  }
  if (input.headcount != null) {
    if (!Number.isInteger(input.headcount) || input.headcount < 1 || input.headcount > 100_000) {
      throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_INVALID);
    }
  }
}

/**
 * 解析用户在指定团体中的成员角色。
 *
 * @param userId - 用户 ID
 * @param groupId - 团体 ID
 * @returns 角色字符串；非成员时 `null`
 */
export async function getGroupRoleForUser(
  userId: number,
  groupId: number,
): Promise<GroupMemberRoleValue | null> {
  const db = getDb();
  const rows = await db
    .select({ memberRole: groupMember.memberRole })
    .from(groupMember)
    .where(and(eq(groupMember.userId, userId), eq(groupMember.groupId, groupId)))
    .limit(1);
  const role = rows[0]?.memberRole;
  if (!role) return null;
  return role as GroupMemberRoleValue;
}

/**
 * 断言用户为团体成员；可选要求必须为 owner。
 *
 * @param userId - 用户 ID
 * @param groupId - 团体 ID
 * @param options - `requireOwner` 为 true 时仅 owner 通过
 * @returns 当前用户在团体中的角色
 * @throws {ApiError} 非成员或非 owner
 */
async function assertGroupAccess(
  userId: number,
  groupId: number,
  options?: { requireOwner?: boolean },
): Promise<GroupMemberRoleValue> {
  const role = await getGroupRoleForUser(userId, groupId);
  if (!role) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_FORBIDDEN);
  }
  if (options?.requireOwner && role !== GroupMemberRole.OWNER) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_OWNER_REQUIRED);
  }
  return role;
}

/**
 * 按 ID 读取团体行；不存在时抛错。
 *
 * @param groupId - 团体主键
 * @returns 团体表行
 * @throws {ApiError} `MARKETPLACE_GROUP_NOT_FOUND`
 */
async function requireDemandGroupRow(groupId: number): Promise<typeof demandGroup.$inferSelect> {
  const db = getDb();
  const rows = await db.select().from(demandGroup).where(eq(demandGroup.id, groupId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND);
  }
  return row;
}

/**
 * 加载团体详情（含成员列表）。
 *
 * @param groupId - 团体主键
 * @returns 团体详情；不存在时 `null`
 */
export async function getDemandGroupDetailById(groupId: number): Promise<DemandGroupDetail | null> {
  const db = getDb();
  const rows = await db.select().from(demandGroup).where(eq(demandGroup.id, groupId)).limit(1);
  const row = rows[0];
  if (!row) return null;

  const memberRows = await db
    .select({
      member: groupMember,
      nickname: users.nickname,
      username: users.username,
    })
    .from(groupMember)
    .leftJoin(users, eq(users.id, groupMember.userId))
    .where(eq(groupMember.groupId, groupId))
    .orderBy(asc(groupMember.id));

  return {
    ...toDemandGroupSummary(row),
    members: memberRows.map((item) =>
      toGroupMemberSummary(item.member, {
        nickname: item.nickname,
        username: item.username ?? '',
      }),
    ),
  };
}

/**
 * 创建发单团体：写入 `demand_group` 并自动插入 `group_member(owner)`。
 *
 * @param userId - 创建者用户 ID（成为 owner）
 * @param input - 团体表单
 * @returns 新建团体详情（含 owner 成员）
 * @throws {ApiError} 参数无效时 `MARKETPLACE_GROUP_INVALID`
 */
export async function createDemandGroup(
  userId: number,
  input: DemandGroupInput,
): Promise<DemandGroupDetail> {
  validateDemandGroupInput(input);

  const db = getDb();
  const [groupResult] = await db.insert(demandGroup).values({
    name: input.name.trim(),
    groupType: input.groupType,
    headcount: input.headcount ?? null,
    ownerUserId: userId,
  });
  const groupId = Number(groupResult.insertId);

  await db.insert(groupMember).values({
    groupId,
    userId,
    memberRole: GroupMemberRole.OWNER,
  });

  const detail = await getDemandGroupDetailById(groupId);
  if (!detail) {
    throw new ApiError(ApiMessageKey.SERVER_ERROR);
  }
  return detail;
}

/**
 * 列出当前用户所属的全部团体（含本人角色）。
 *
 * @param userId - 用户 ID
 * @returns 成员关系列表，按团体 id 升序
 */
export async function listGroupMembershipsByUser(
  userId: number,
): Promise<GroupMembershipSummary[]> {
  const db = getDb();
  const rows = await db
    .select({
      groupId: groupMember.groupId,
      memberRole: groupMember.memberRole,
      group: demandGroup,
    })
    .from(groupMember)
    .innerJoin(demandGroup, eq(groupMember.groupId, demandGroup.id))
    .where(eq(groupMember.userId, userId))
    .orderBy(asc(groupMember.groupId));

  return rows.map((row) => ({
    groupId: row.groupId,
    memberRole: row.memberRole as GroupMemberRoleValue,
    group: toDemandGroupSummary(row.group),
  }));
}

/**
 * 读取团体详情；调用方须为成员。
 *
 * @param groupId - 团体主键
 * @param userId - 当前用户 ID
 * @returns 团体详情
 * @throws {ApiError} 不存在或非成员
 */
export async function getDemandGroupDetailForUser(
  groupId: number,
  userId: number,
): Promise<DemandGroupDetail> {
  await requireDemandGroupRow(groupId);
  await assertGroupAccess(userId, groupId);

  const detail = await getDemandGroupDetailById(groupId);
  if (!detail) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND);
  }
  return detail;
}

/**
 * 更新团体基础信息；仅 owner 可操作。
 *
 * @param groupId - 团体主键
 * @param userId - 当前用户 ID
 * @param input - 更新表单
 * @returns 更新后的团体详情
 * @throws {ApiError} 不存在、非 owner 或参数无效
 */
export async function updateDemandGroup(
  groupId: number,
  userId: number,
  input: DemandGroupInput,
): Promise<DemandGroupDetail> {
  validateDemandGroupInput(input);
  await requireDemandGroupRow(groupId);
  await assertGroupAccess(userId, groupId, { requireOwner: true });

  const db = getDb();
  await db
    .update(demandGroup)
    .set({
      name: input.name.trim(),
      groupType: input.groupType,
      headcount: input.headcount ?? null,
    })
    .where(eq(demandGroup.id, groupId));

  const detail = await getDemandGroupDetailById(groupId);
  if (!detail) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND);
  }
  return detail;
}

/**
 * 删除团体；仅 owner 可操作。成员行随外键 cascade 删除。
 *
 * @param groupId - 团体主键
 * @param userId - 当前用户 ID
 * @returns 无返回值
 * @throws {ApiError} 不存在或非 owner
 */
export async function deleteDemandGroup(groupId: number, userId: number): Promise<void> {
  await requireDemandGroupRow(groupId);
  await assertGroupAccess(userId, groupId, { requireOwner: true });

  const db = getDb();
  await db.delete(demandGroup).where(eq(demandGroup.id, groupId));
}

/**
 * 邀请协作者加入团体；仅 owner 可操作，角色固定为 `collaborator`。
 *
 * @param groupId - 团体主键
 * @param ownerUserId - 当前操作者（须为 owner）
 * @param input - 被邀请用户 ID
 * @returns 新建成员摘要
 * @throws {ApiError} 非 owner、用户不存在或已是成员
 */
export async function inviteGroupMember(
  groupId: number,
  ownerUserId: number,
  input: InviteGroupMemberInput,
): Promise<GroupMemberSummary> {
  if (!Number.isInteger(input.userId) || input.userId <= 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_INVALID);
  }

  await requireDemandGroupRow(groupId);
  await assertGroupAccess(ownerUserId, groupId, { requireOwner: true });

  const db = getDb();
  const targetUsers = await db
    .select({ id: users.id, nickname: users.nickname, username: users.username })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  const target = targetUsers[0];
  if (!target) {
    throw new ApiError(ApiMessageKey.USER_NOT_FOUND);
  }

  const existingRole = await getGroupRoleForUser(input.userId, groupId);
  if (existingRole) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_MEMBER_ALREADY_EXISTS);
  }

  const [insertResult] = await db.insert(groupMember).values({
    groupId,
    userId: input.userId,
    memberRole: GroupMemberRole.COLLABORATOR,
  });
  const memberId = Number(insertResult.insertId);

  const memberRows = await db
    .select()
    .from(groupMember)
    .where(eq(groupMember.id, memberId))
    .limit(1);
  const memberRow = memberRows[0];
  if (!memberRow) {
    throw new ApiError(ApiMessageKey.SERVER_ERROR);
  }

  return toGroupMemberSummary(memberRow, {
    nickname: target.nickname,
    username: target.username,
  });
}

/**
 * 移除团体成员；仅 owner 可操作，且不能移除 owner 本人。
 *
 * @param groupId - 团体主键
 * @param ownerUserId - 当前操作者（须为 owner）
 * @param targetUserId - 被移除用户 ID
 * @returns 无返回值
 * @throws {ApiError} 非 owner、目标非成员或目标为 owner
 */
export async function removeGroupMember(
  groupId: number,
  ownerUserId: number,
  targetUserId: number,
): Promise<void> {
  if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_INVALID);
  }

  await requireDemandGroupRow(groupId);
  await assertGroupAccess(ownerUserId, groupId, { requireOwner: true });

  const targetRole = await getGroupRoleForUser(targetUserId, groupId);
  if (!targetRole) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_MEMBER_NOT_FOUND);
  }
  if (targetRole === GroupMemberRole.OWNER) {
    throw new ApiError(ApiMessageKey.MARKETPLACE_GROUP_CANNOT_REMOVE_OWNER);
  }

  const db = getDb();
  await db
    .delete(groupMember)
    .where(
      and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, targetUserId),
        ne(groupMember.memberRole, GroupMemberRole.OWNER),
      ),
    );
}
