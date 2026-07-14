/**
 * M3-1 · 发单接单团体 CRUD 验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m3:marketplace-group-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  DemandGroupType,
  GroupMemberRole,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { demandGroup, groupMember } from '../db/schema/marketplace-demand.js';
import {
  createDemandGroup,
  deleteDemandGroup,
  getDemandGroupDetailForUser,
  getGroupRoleForUser,
  inviteGroupMember,
  listGroupMembershipsByUser,
  removeGroupMember,
  updateDemandGroup,
} from '../services/marketplace/marketplace-group.service.js';

let failed = 0;

/**
 * 断言条件为真，失败时累计失败计数并打印标签。
 *
 * @param condition - 期望为真的条件
 * @param label - 用例描述
 */
function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

/**
 * 获取或创建 M3 测试专用用户。
 *
 * @param username - 测试用户名
 * @returns 用户 ID
 */
async function ensureTestUser(username: string): Promise<number> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (rows[0]) return rows[0].id;

  const [result] = await db.insert(users).values({
    username,
    passwordHash: 'm3-test-placeholder',
    nickname: username,
    email: `${username}@m3.test`,
  });
  return Number(result.insertId);
}

/**
 * 清理测试用户关联的团体记录（便于重复跑用例）。
 *
 * @param userId - 用户 ID
 */
async function cleanupUserGroupData(userId: number): Promise<void> {
  const db = getDb();
  const owned = await db
    .select({ id: demandGroup.id })
    .from(demandGroup)
    .where(eq(demandGroup.ownerUserId, userId));

  for (const row of owned) {
    await db.delete(groupMember).where(eq(groupMember.groupId, row.id));
    await db.delete(demandGroup).where(eq(demandGroup.id, row.id));
  }

  await db.delete(groupMember).where(eq(groupMember.userId, userId));
}

/**
 * 检查团体表与 i18n 键。
 */
async function checkSchemaAndI18n() {
  console.log('--- Schema & i18n ---');
  try {
    await getDb().select({ id: demandGroup.id }).from(demandGroup).limit(1);
    assert(true, '表 demand_group 存在');
  } catch {
    assert(false, '表 demand_group 存在');
  }

  try {
    await getDb().select({ id: groupMember.id }).from(groupMember).limit(1);
    assert(true, '表 group_member 存在');
  } catch {
    assert(false, '表 group_member 存在');
  }

  const keys = [
    ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_GROUP_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_GROUP_MEMBER_ALREADY_EXISTS,
    ApiMessageKey.MARKETPLACE_GROUP_OWNER_REQUIRED,
    ApiMessageKey.MARKETPLACE_GROUP_CANNOT_REMOVE_OWNER,
  ] as const;

  for (const key of keys) {
    const zh = resolveApiMessage(key, 'zh-CN');
    const en = resolveApiMessage(key, 'en-US');
    assert(zh.length > 0 && zh !== key, `zh-CN ${key}`);
    assert(en.length > 0 && en !== key, `en-US ${key}`);
  }
  console.log('');
}

/**
 * 走通创建团体 → 邀请协作者 → 更新 → 权限校验 → 移除 → 删除。
 */
async function checkGroupCrudFlow() {
  console.log('--- 团体 CRUD ---');
  const ownerUsername = 'm3_group_owner';
  const collabUsername = 'm3_group_collab';
  const strangerUsername = 'm3_group_stranger';

  const ownerId = await ensureTestUser(ownerUsername);
  const collabId = await ensureTestUser(collabUsername);
  const strangerId = await ensureTestUser(strangerUsername);

  await cleanupUserGroupData(ownerId);
  await cleanupUserGroupData(collabId);
  await cleanupUserGroupData(strangerId);

  const created = await createDemandGroup(ownerId, {
    name: 'M3 测试团建组',
    groupType: DemandGroupType.COMPANY,
    headcount: 20,
  });

  assert(created.name === 'M3 测试团建组', '创建团体成功');
  assert(created.groupType === DemandGroupType.COMPANY, '团体类型=company');
  assert(created.headcount === 20, '预计人数=20');
  assert(created.ownerUserId === ownerId, 'ownerUserId 为创建者');
  assert(created.members.length === 1, '创建后仅 1 名成员');
  assert(created.members[0]?.memberRole === GroupMemberRole.OWNER, '创建者角色=owner');

  const ownerRole = await getGroupRoleForUser(ownerId, created.id);
  assert(ownerRole === GroupMemberRole.OWNER, 'getGroupRoleForUser 解析 owner');

  const mine = await listGroupMembershipsByUser(ownerId);
  assert(
    mine.some((item) => item.groupId === created.id && item.memberRole === GroupMemberRole.OWNER),
    '我的团体列表含新建团体',
  );

  const invited = await inviteGroupMember(created.id, ownerId, { userId: collabId });
  assert(invited.userId === collabId, '邀请协作者成功');
  assert(invited.memberRole === GroupMemberRole.COLLABORATOR, '受邀角色=collaborator');

  const detail = await getDemandGroupDetailForUser(created.id, collabId);
  assert(detail.members.length === 2, '详情含 owner + collaborator');

  const collabMine = await listGroupMembershipsByUser(collabId);
  assert(
    collabMine.some(
      (item) => item.groupId === created.id && item.memberRole === GroupMemberRole.COLLABORATOR,
    ),
    '协作者我的团体列表可见',
  );

  let duplicateBlocked = false;
  try {
    await inviteGroupMember(created.id, ownerId, { userId: collabId });
  } catch (err) {
    duplicateBlocked =
      err instanceof ApiError &&
      err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_MEMBER_ALREADY_EXISTS;
  }
  assert(duplicateBlocked, '重复邀请抛 MARKETPLACE_GROUP_MEMBER_ALREADY_EXISTS');

  let strangerForbidden = false;
  try {
    await getDemandGroupDetailForUser(created.id, strangerId);
  } catch (err) {
    strangerForbidden =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_FORBIDDEN;
  }
  assert(strangerForbidden, '非成员读详情抛 MARKETPLACE_GROUP_FORBIDDEN');

  let collabCannotUpdate = false;
  try {
    await updateDemandGroup(created.id, collabId, {
      name: '应失败',
      groupType: DemandGroupType.SCHOOL,
    });
  } catch (err) {
    collabCannotUpdate =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_OWNER_REQUIRED;
  }
  assert(collabCannotUpdate, '协作者更新抛 MARKETPLACE_GROUP_OWNER_REQUIRED');

  const updated = await updateDemandGroup(created.id, ownerId, {
    name: 'M3 测试团建组（已改）',
    groupType: DemandGroupType.COMMUNITY,
    headcount: 30,
  });
  assert(updated.name === 'M3 测试团建组（已改）', 'owner 可更新名称');
  assert(updated.groupType === DemandGroupType.COMMUNITY, 'owner 可更新类型');
  assert(updated.headcount === 30, 'owner 可更新人数');

  let cannotRemoveOwner = false;
  try {
    await removeGroupMember(created.id, ownerId, ownerId);
  } catch (err) {
    cannotRemoveOwner =
      err instanceof ApiError &&
      err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_CANNOT_REMOVE_OWNER;
  }
  assert(cannotRemoveOwner, '移除 owner 抛 MARKETPLACE_GROUP_CANNOT_REMOVE_OWNER');

  await removeGroupMember(created.id, ownerId, collabId);
  const afterRemove = await getDemandGroupDetailForUser(created.id, ownerId);
  assert(afterRemove.members.length === 1, '移除协作者后仅剩 owner');
  assert((await getGroupRoleForUser(collabId, created.id)) === null, '协作者角色已清除');

  await deleteDemandGroup(created.id, ownerId);
  let deletedNotFound = false;
  try {
    await getDemandGroupDetailForUser(created.id, ownerId);
  } catch (err) {
    deletedNotFound =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND;
  }
  assert(deletedNotFound, '删除后读详情抛 MARKETPLACE_GROUP_NOT_FOUND');

  const mineAfterDelete = await listGroupMembershipsByUser(ownerId);
  assert(!mineAfterDelete.some((item) => item.groupId === created.id), '删除后我的列表不含该团体');
  console.log('');
}

async function main() {
  console.log('=== M3-1 Marketplace 团体 CRUD 验收 ===\n');
  await checkSchemaAndI18n();
  await checkGroupCrudFlow();

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('M3-1 Marketplace 团体 CRUD 验收全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error('[m3-marketplace-group-cases] 运行失败:', err);
  process.exit(1);
});
