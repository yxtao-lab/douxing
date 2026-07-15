/**
 * M3 · 发单接单团体全阶段验收（M3-1～M3-5）
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m3:marketplace-group-cases
 */
import '../config/env.js';
import { eq, inArray } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  BizOrgStatus,
  BizOrgType,
  DemandGroupType,
  DemandStatus,
  GroupMemberRole,
  InvoiceTitleType,
  OrgDocumentType,
  OrgRole,
  PublisherType,
  QuoteStatus,
  ServiceOrderStatus,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { demandGroup, demandQuote, groupMember, serviceDemand } from '../db/schema/marketplace-demand.js';
import { serviceOrder } from '../db/schema/marketplace-order.js';
import {
  createDemand,
  getDemandByIdForUser,
  listDemandsByUser,
  listPublishedDemands,
  publishDemand,
  updateDemand,
} from '../services/marketplace/marketplace-demand.service.js';
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
import {
  applyBizOrg,
  getOrgRoleForUser,
  reviewBizOrg,
} from '../services/marketplace/marketplace-org-onboard.service.js';
import { createDemandQuote, listQuotesForDemand } from '../services/marketplace/marketplace-quote.service.js';
import {
  advanceServiceOrderStatus,
  payMockServiceOrder,
  selectQuoteAndCreateOrder,
} from '../services/marketplace/marketplace-order.service.js';

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
 * 按需求 ID 列表删除订单、报价与需求本身。
 *
 * @param demandIds - 需求主键列表
 */
async function deleteDemandsCascade(demandIds: number[]): Promise<void> {
  if (demandIds.length === 0) return;
  const db = getDb();
  await db.delete(serviceOrder).where(inArray(serviceOrder.demandId, demandIds));
  await db.delete(demandQuote).where(inArray(demandQuote.demandId, demandIds));
  await db.delete(serviceDemand).where(inArray(serviceDemand.id, demandIds));
}

/**
 * 清理测试用户关联的团体、团体需求及本人发单数据（便于重复跑用例）。
 *
 * @param userId - 用户 ID
 */
async function cleanupUserGroupData(userId: number): Promise<void> {
  const db = getDb();
  const owned = await db
    .select({ id: demandGroup.id })
    .from(demandGroup)
    .where(eq(demandGroup.ownerUserId, userId));

  const ownedIds = owned.map((row) => row.id);
  if (ownedIds.length > 0) {
    const groupDemands = await db
      .select({ id: serviceDemand.id })
      .from(serviceDemand)
      .where(inArray(serviceDemand.publisherGroupId, ownedIds));
    await deleteDemandsCascade(groupDemands.map((row) => row.id));
    await db.delete(groupMember).where(inArray(groupMember.groupId, ownedIds));
    await db.delete(demandGroup).where(inArray(demandGroup.id, ownedIds));
  }

  await db.delete(groupMember).where(eq(groupMember.userId, userId));

  const ownDemands = await db
    .select({ id: serviceDemand.id })
    .from(serviceDemand)
    .where(eq(serviceDemand.publisherUserId, userId));
  await deleteDemandsCascade(ownDemands.map((row) => row.id));
}

/**
 * 清理商户组织测试数据（入驻申请与成员）。
 *
 * @param userId - 商户 owner 用户 ID
 */
async function cleanupOrgData(userId: number): Promise<void> {
  const db = getDb();
  const memberships = await db
    .select({ orgId: orgMember.orgId })
    .from(orgMember)
    .where(eq(orgMember.userId, userId));

  for (const row of memberships) {
    await db.delete(bizOrgDocument).where(eq(bizOrgDocument.orgId, row.orgId));
    await db.delete(orgMember).where(eq(orgMember.orgId, row.orgId));
    await db.delete(bizOrg).where(eq(bizOrg.id, row.orgId));
  }
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

  try {
    await getDb()
      .select({
        id: serviceDemand.id,
        publisherGroupId: serviceDemand.publisherGroupId,
        headcount: serviceDemand.headcount,
        invoiceInfo: serviceDemand.invoiceInfo,
      })
      .from(serviceDemand)
      .limit(1);
    assert(true, '表 service_demand 含 publisher_group_id / headcount / invoice_info');
  } catch {
    assert(false, '表 service_demand 含 publisher_group_id / headcount / invoice_info');
  }

  const keys = [
    ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND,
    ApiMessageKey.MARKETPLACE_GROUP_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_GROUP_MEMBER_ALREADY_EXISTS,
    ApiMessageKey.MARKETPLACE_GROUP_OWNER_REQUIRED,
    ApiMessageKey.MARKETPLACE_GROUP_CANNOT_REMOVE_OWNER,
    ApiMessageKey.MARKETPLACE_DEMAND_FORBIDDEN,
    ApiMessageKey.MARKETPLACE_DEMAND_INVALID,
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
  console.log('--- 团体 CRUD（M3-1） ---');
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

/**
 * M3-2：团体发单 — publisher_type=group · 权限 · 发布到大厅。
 */
async function checkGroupDemandPublishFlow() {
  console.log('--- 团体发单（M3-2） ---');
  const ownerUsername = 'm3_demand_owner';
  const collabUsername = 'm3_demand_collab';
  const strangerUsername = 'm3_demand_stranger';

  const ownerId = await ensureTestUser(ownerUsername);
  const collabId = await ensureTestUser(collabUsername);
  const strangerId = await ensureTestUser(strangerUsername);

  await cleanupUserGroupData(ownerId);
  await cleanupUserGroupData(collabId);
  await cleanupUserGroupData(strangerId);

  const group = await createDemandGroup(ownerId, {
    name: '2026 公司团建组',
    groupType: DemandGroupType.COMPANY,
    headcount: 20,
  });
  await inviteGroupMember(group.id, ownerId, { userId: collabId });

  const draft = await createDemand(ownerId, {
    categoryCode: 'travel.group_tour',
    title: '2026 公司团建定制游',
    description: 'M3-2 团体发单验收',
    destination: '杭州',
    publisherGroupId: group.id,
  });

  assert(draft.publisherType === PublisherType.GROUP, 'owner 发单 publisherType=group');
  assert(draft.publisherGroupId === group.id, '需求挂 publisherGroupId');
  assert(draft.publisherUserId === ownerId, 'publisherUserId 为操作者');
  assert(draft.status === DemandStatus.DRAFT, '新建为 draft');

  const collabDraft = await createDemand(collabId, {
    categoryCode: 'travel.custom_tour',
    title: '协作者发起的团体需求',
    destination: '苏州',
    publisherGroupId: group.id,
  });
  assert(collabDraft.publisherType === PublisherType.GROUP, '协作者可创建团体需求');
  assert(collabDraft.publisherUserId === collabId, '协作者创建时 publisherUserId=协作者');

  let strangerCreateBlocked = false;
  try {
    await createDemand(strangerId, {
      categoryCode: 'travel.group_tour',
      title: '非成员应失败',
      publisherGroupId: group.id,
    });
  } catch (err) {
    strangerCreateBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_FORBIDDEN;
  }
  assert(strangerCreateBlocked, '非成员创建抛 MARKETPLACE_GROUP_FORBIDDEN');

  let missingGroupBlocked = false;
  try {
    await createDemand(ownerId, {
      categoryCode: 'travel.group_tour',
      title: '无效团体应失败',
      publisherGroupId: 999_999_999,
    });
  } catch (err) {
    missingGroupBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_GROUP_NOT_FOUND;
  }
  assert(missingGroupBlocked, '无效团体抛 MARKETPLACE_GROUP_NOT_FOUND');

  const updated = await updateDemand(draft.id, collabId, {
    categoryCode: 'travel.group_tour',
    title: '2026 公司团建定制游（协作者已改）',
    destination: '杭州西湖',
  });
  assert(updated.title.includes('协作者已改'), '协作者可更新团体草稿');
  assert(updated.publisherGroupId === group.id, '更新后仍保留 publisherGroupId');

  let strangerUpdateBlocked = false;
  try {
    await updateDemand(draft.id, strangerId, {
      categoryCode: 'travel.group_tour',
      title: '非成员改标题应失败',
    });
  } catch (err) {
    strangerUpdateBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_DEMAND_FORBIDDEN;
  }
  assert(strangerUpdateBlocked, '非成员更新抛 MARKETPLACE_DEMAND_FORBIDDEN');

  const ownerCanReadCollab = await getDemandByIdForUser(collabDraft.id, ownerId);
  assert(ownerCanReadCollab.id === collabDraft.id, 'owner 可读协作者创建的团体需求');

  const mineOwner = await listDemandsByUser(ownerId);
  assert(
    mineOwner.some((item) => item.id === draft.id && item.publisherGroupId === group.id),
    'owner「我的需求」含团体单',
  );
  assert(
    mineOwner.some((item) => item.id === collabDraft.id),
    'owner「我的需求」含协作者创建的团体单',
  );

  const published = await publishDemand(draft.id, collabId);
  assert(published.status === DemandStatus.PUBLISHED, '协作者可发布团体草稿');

  const hall = await listPublishedDemands({ keyword: '公司团建', page: 1, pageSize: 20 });
  assert(
    hall.items.some((item) => item.id === draft.id && item.publisherType === PublisherType.GROUP),
    '发布后大厅可见团体需求',
  );

  await cleanupUserGroupData(ownerId);
  await cleanupUserGroupData(collabId);
  await cleanupUserGroupData(strangerId);
  console.log('');
}

/**
 * M3-3：需求单 headcount 与发票抬头 JSON 读写与校验。
 */
async function checkDemandHeadcountInvoiceFlow() {
  console.log('--- 人数与发票（M3-3） ---');
  const ownerUsername = 'm3_invoice_owner';
  const ownerId = await ensureTestUser(ownerUsername);
  await cleanupUserGroupData(ownerId);

  const group = await createDemandGroup(ownerId, {
    name: 'M3-3 发票测试团',
    groupType: DemandGroupType.COMPANY,
    headcount: 50,
  });

  const draft = await createDemand(ownerId, {
    categoryCode: 'travel.group_tour',
    title: '含人数与发票的团体需求',
    destination: '上海',
    publisherGroupId: group.id,
    headcount: 50,
    invoiceInfo: {
      titleType: InvoiceTitleType.COMPANY,
      title: '兜行测试科技有限公司',
      taxNo: '91310000MA1FLTEST0',
      address: '上海市浦东新区',
      phone: '021-00000000',
    },
  });

  assert(draft.headcount === 50, '创建写入 headcount=50');
  assert(draft.invoiceInfo?.titleType === InvoiceTitleType.COMPANY, '发票 titleType=company');
  assert(draft.invoiceInfo?.title === '兜行测试科技有限公司', '发票抬头名称正确');
  assert(draft.invoiceInfo?.taxNo === '91310000MA1FLTEST0', '发票税号正确');

  let companyMissingTaxBlocked = false;
  try {
    await createDemand(ownerId, {
      categoryCode: 'travel.group_tour',
      title: '企业发票缺税号应失败',
      publisherGroupId: group.id,
      invoiceInfo: {
        titleType: InvoiceTitleType.COMPANY,
        title: '缺税号公司',
      },
    });
  } catch (err) {
    companyMissingTaxBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_DEMAND_INVALID;
  }
  assert(companyMissingTaxBlocked, '企业发票缺税号抛 MARKETPLACE_DEMAND_INVALID');

  let badHeadcountBlocked = false;
  try {
    await createDemand(ownerId, {
      categoryCode: 'travel.group_tour',
      title: '非法人数应失败',
      publisherGroupId: group.id,
      headcount: 0,
    });
  } catch (err) {
    badHeadcountBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_DEMAND_INVALID;
  }
  assert(badHeadcountBlocked, 'headcount=0 抛 MARKETPLACE_DEMAND_INVALID');

  const personal = await updateDemand(draft.id, ownerId, {
    categoryCode: 'travel.group_tour',
    title: '含人数与发票的团体需求（已改）',
    destination: '上海',
    headcount: 80,
    invoiceInfo: {
      titleType: InvoiceTitleType.PERSONAL,
      title: '张三',
    },
  });
  assert(personal.headcount === 80, '更新 headcount=80');
  assert(personal.invoiceInfo?.titleType === InvoiceTitleType.PERSONAL, '可改为个人抬头');
  assert(personal.invoiceInfo?.title === '张三', '个人抬头名称正确');

  const cleared = await updateDemand(draft.id, ownerId, {
    categoryCode: 'travel.group_tour',
    title: '含人数与发票的团体需求（已改）',
    destination: '上海',
    headcount: null,
    invoiceInfo: null,
  });
  assert(cleared.headcount === null, '可清空 headcount');
  assert(cleared.invoiceInfo === null, '可清空 invoiceInfo');

  await cleanupUserGroupData(ownerId);
  console.log('');
}

/**
 * M3-5：公司团建端到端 — 建团 → 邀请 HR → 团体发单（人数+发票）→ 发布 →
 * 旅行社报价 → 协作者选定/支付/履约；并断言团员不可自报价。
 */
async function checkCompanyTeamBuildingFlow() {
  console.log('--- 公司团建全链（M3-5） ---');
  const hrOwnerUsername = 'm3_team_hr';
  const collabUsername = 'm3_team_collab';
  const agencyUsername = 'm3_team_agency';

  const hrId = await ensureTestUser(hrOwnerUsername);
  const collabId = await ensureTestUser(collabUsername);
  const agencyId = await ensureTestUser(agencyUsername);

  await cleanupUserGroupData(hrId);
  await cleanupUserGroupData(collabId);
  await cleanupUserGroupData(agencyId);
  await cleanupOrgData(agencyId);

  const group = await createDemandGroup(hrId, {
    name: '2026 公司团建组',
    groupType: DemandGroupType.COMPANY,
    headcount: 20,
  });
  assert(group.groupType === DemandGroupType.COMPANY, '团建团体类型=company');
  assert(group.headcount === 20, '团体预计人数=20');

  await inviteGroupMember(group.id, hrId, { userId: collabId });
  const detail = await getDemandGroupDetailForUser(group.id, collabId);
  assert(detail.members.length === 2, '邀请后成员=owner+协作者');

  const draft = await createDemand(hrId, {
    categoryCode: 'travel.group_tour',
    title: '2026 公司团建定制游',
    description: 'M3-5 公司团建验收 · 含住宿与团建活动',
    destination: '杭州',
    publisherGroupId: group.id,
    headcount: 20,
    budgetMin: '30000',
    budgetMax: '50000',
    budgetType: 'range',
    invoiceInfo: {
      titleType: InvoiceTitleType.COMPANY,
      title: '兜行团建科技有限公司',
      taxNo: '91310000MA1FLTEAM0',
    },
  });
  assert(draft.publisherType === PublisherType.GROUP, '团建需求 publisherType=group');
  assert(draft.publisherGroupId === group.id, '团建需求挂团体');
  assert(draft.headcount === 20, '需求 headcount=20');
  assert(draft.invoiceInfo?.taxNo === '91310000MA1FLTEAM0', '发票税号已写入');

  const published = await publishDemand(draft.id, collabId);
  assert(published.status === DemandStatus.PUBLISHED, '协作者可发布团建需求');

  const hall = await listPublishedDemands({ keyword: '公司团建', page: 1, pageSize: 20 });
  assert(
    hall.items.some((item) => item.id === draft.id && item.publisherType === PublisherType.GROUP),
    '大厅可见公司团建需求',
  );

  let memberSelfQuoteBlocked = false;
  try {
    await createDemandQuote(draft.id, collabId, {
      amount: '1.00',
      proposalText: '团员自报价应失败',
    });
  } catch (err) {
    memberSelfQuoteBlocked =
      err instanceof ApiError && err.messageKey === ApiMessageKey.MARKETPLACE_QUOTE_INVALID;
  }
  assert(memberSelfQuoteBlocked, '团体成员不可对本团需求报价');

  const appliedOrg = await applyBizOrg(agencyId, {
    name: 'M3 团建旅行社',
    orgType: BizOrgType.TRAVEL_AGENCY,
    licenseNo: 'M3-TRAVEL-001',
    contactPhone: '13800000033',
    documents: [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: '/uploads/marketplace/test/m3-license.pdf',
        fileName: 'license.pdf',
      },
    ],
  });

  const reviewerRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'admin'))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? agencyId;
  const approvedOrg = await reviewBizOrg(appliedOrg.id, reviewerId, { action: 'approve' });
  assert(approvedOrg.status === BizOrgStatus.ACTIVE, '旅行社审核通过');
  assert((await getOrgRoleForUser(agencyId, appliedOrg.id)) === OrgRole.OWNER, '旅行社 owner 角色');

  const quote = await createDemandQuote(draft.id, agencyId, {
    amount: '42000.00',
    proposalText: '含住宿、用车与半天团建活动',
    orgId: appliedOrg.id,
  });
  assert(quote.status === QuoteStatus.PENDING, '旅行社报价成功');
  assert(quote.orgId === appliedOrg.id, '报价写入 orgId');

  const quotes = await listQuotesForDemand(draft.id);
  assert(quotes.some((item) => item.id === quote.id), '协作者可读报价列表');

  const demandAfterQuote = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(demandAfterQuote[0]?.status === DemandStatus.QUOTING, '首条报价后 status=quoting');

  const order = await selectQuoteAndCreateOrder(draft.id, collabId, { quoteId: quote.id });
  assert(order.status === ServiceOrderStatus.PENDING_PAY, '协作者选定报价生成订单');
  assert(order.totalAmount === '42000.00', '订单金额与报价一致');

  const paid = await payMockServiceOrder(order.id, collabId);
  assert(paid.status === ServiceOrderStatus.PAID, '协作者模拟支付成功');

  await advanceServiceOrderStatus(order.id, collabId, { status: ServiceOrderStatus.IN_PROGRESS });
  await advanceServiceOrderStatus(order.id, collabId, { status: ServiceOrderStatus.DELIVERED });
  const confirmed = await advanceServiceOrderStatus(order.id, collabId, {
    status: ServiceOrderStatus.CONFIRMED,
  });
  assert(confirmed.status === ServiceOrderStatus.CONFIRMED, '履约推进至 confirmed');

  const completed = await getDb()
    .select({ status: serviceDemand.status })
    .from(serviceDemand)
    .where(eq(serviceDemand.id, draft.id))
    .limit(1);
  assert(completed[0]?.status === DemandStatus.COMPLETED, '确认后需求 status=completed');

  // owner 仍可读取已完成的团体需求
  const ownerView = await getDemandByIdForUser(draft.id, hrId);
  assert(ownerView.id === draft.id, 'owner 可读协作者走完的团体需求');

  await cleanupUserGroupData(hrId);
  await cleanupUserGroupData(collabId);
  await cleanupUserGroupData(agencyId);
  await cleanupOrgData(agencyId);
  console.log('');
}

async function main() {
  console.log('=== M3 Marketplace 团体全阶段验收（M3-1～M3-5） ===\n');
  await checkSchemaAndI18n();
  await checkGroupCrudFlow();
  await checkGroupDemandPublishFlow();
  await checkDemandHeadcountInvoiceFlow();
  await checkCompanyTeamBuildingFlow();

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('M3 Marketplace 团体全阶段验收全部通过（含公司团建全链）');
  process.exit(0);
}

main().catch((err) => {
  console.error('[m3-marketplace-group-cases] 运行失败:', err);
  process.exit(1);
});
