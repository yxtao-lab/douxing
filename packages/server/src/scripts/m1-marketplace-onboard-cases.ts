/**
 * M1 · 发单接单供给入驻验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server m1:marketplace-onboard-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import {
  ApiMessageKey,
  BizOrgStatus,
  BizOrgType,
  CertStatus,
  OrgDocumentType,
  OrgRole,
  ProviderType,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { bizOrg, orgMember } from '../db/schema/marketplace-biz-org.js';
import { bizOrgDocument } from '../db/schema/marketplace-biz-org-documents.js';
import { serviceProvider } from '../db/schema/marketplace-provider.js';
import {
  applyBizOrg,
  getBizOrgDetailById,
  getOrgRoleForUser,
  listBizOrgsForAdminPage,
  reviewBizOrg,
  userHasActiveOrgApplication,
} from '../services/marketplace/marketplace-org-onboard.service.js';
import {
  applyServiceProvider,
  getApprovedProviderPublicProfile,
  isApprovedServiceProvider,
  reviewServiceProvider,
} from '../services/marketplace/marketplace-provider.service.js';

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
 * 获取或创建 M1 测试专用用户。
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
    passwordHash: 'm1-test-placeholder',
    nickname: username,
    email: `${username}@m1.test`,
  });
  return Number(result.insertId);
}

/**
 * 清理测试用户关联的商户与服务者记录（便于重复跑用例）。
 *
 * @param userId - 用户 ID
 */
async function cleanupUserMarketplaceData(userId: number): Promise<void> {
  const db = getDb();
  await db.delete(serviceProvider).where(eq(serviceProvider.userId, userId));

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
 * 检查 M1 新增表与 i18n 键。
 */
async function checkSchemaAndI18n() {
  console.log('--- Schema & i18n ---');
  try {
    await getDb().select({ id: bizOrgDocument.id }).from(bizOrgDocument).limit(1);
    assert(true, '表 biz_org_documents 存在');
  } catch {
    assert(false, '表 biz_org_documents 存在');
  }

  const keys = [
    ApiMessageKey.MARKETPLACE_ORG_ALREADY_APPLIED,
    ApiMessageKey.MARKETPLACE_PROVIDER_NOT_APPROVED,
    ApiMessageKey.MARKETPLACE_ORG_CONTEXT_REQUIRED,
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
 * 走通商户入驻 → 审核 → 激活流程。
 */
async function checkOrgOnboardFlow() {
  console.log('--- 商户入驻审核 ---');
  const applicantUsername = 'm1_org_applicant';
  const reviewerUsername = 'admin';
  const applicantId = await ensureTestUser(applicantUsername);
  await cleanupUserMarketplaceData(applicantId);

  assert(!(await userHasActiveOrgApplication(applicantId)), '申请人无进行中入驻');

  const applied = await applyBizOrg(applicantId, {
    name: 'M1 测试旅行社',
    orgType: BizOrgType.TRAVEL_AGENCY,
    licenseNo: 'M1-LIC-001',
    contactPhone: '13800000001',
    description: 'M1 验收用商户',
    documents: [
      {
        docType: OrgDocumentType.LICENSE,
        fileUrl: '/uploads/marketplace/test/license.pdf',
        fileName: 'license.pdf',
      },
    ],
  });

  assert(applied.status === BizOrgStatus.PENDING, '申请后 status=pending');
  assert(applied.documents.length >= 1, '写入资质附件');

  const ownerRole = await getOrgRoleForUser(applicantId, applied.id);
  assert(ownerRole === OrgRole.OWNER, '申请人成为 owner');

  const reviewerRows = await getDb()
    .select()
    .from(users)
    .where(eq(users.username, reviewerUsername))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? applicantId;

  const pendingPage = await listBizOrgsForAdminPage({
    page: 1,
    pageSize: 20,
    status: BizOrgStatus.PENDING,
    keyword: 'M1 测试旅行社',
  });
  assert(pendingPage.items.some((item) => item.id === applied.id), '待审列表含新申请');

  const approved = await reviewBizOrg(applied.id, reviewerId, {
    action: 'approve',
    reviewNote: 'M1 自动验收通过',
  });
  assert(approved.status === BizOrgStatus.ACTIVE, '审核通过后 status=active');

  const detail = await getBizOrgDetailById(applied.id);
  assert(detail?.reviewNote === 'M1 自动验收通过', '审核备注已写入');
  console.log('');
}

/**
 * 走通个人服务者认证 → 审核 → 公开主页流程。
 */
async function checkProviderOnboardFlow() {
  console.log('--- 服务者认证 ---');
  const providerUsername = 'm1_provider_applicant';
  const reviewerUsername = 'admin';
  const userId = await ensureTestUser(providerUsername);
  await cleanupUserMarketplaceData(userId);

  const applied = await applyServiceProvider(userId, {
    providerType: ProviderType.GUIDE,
    categoryCodes: ['travel.guide', 'travel.custom_tour'],
    serviceRegions: ['杭州'],
    displayName: 'M1 测试向导',
    bio: '五年带队经验',
    portfolioUrls: ['/uploads/marketplace/test/portfolio.jpg'],
  });

  assert(applied.certStatus === CertStatus.PENDING, '申请后 cert_status=pending');

  const reviewerRows = await getDb()
    .select()
    .from(users)
    .where(eq(users.username, reviewerUsername))
    .limit(1);
  const reviewerId = reviewerRows[0]?.id ?? userId;

  const approved = await reviewServiceProvider(applied.id, reviewerId, {
    action: 'approve',
  });
  assert(approved.certStatus === CertStatus.APPROVED, '审核通过后 cert_status=approved');
  assert(await isApprovedServiceProvider(userId), '具备报价资格');

  const publicProfile = await getApprovedProviderPublicProfile(applied.id);
  assert(publicProfile?.displayName === 'M1 测试向导', '公开主页可访问');
  assert((publicProfile?.portfolioUrls?.length ?? 0) >= 1, '公开主页含作品集');

  const blockedProfile = await getApprovedProviderPublicProfile(999999);
  assert(blockedProfile === null, '不存在的服务者无公开页');
  console.log('');
}

/**
 * 校验 org-context 所需角色解析（服务层）。
 */
async function checkOrgContext() {
  console.log('--- 商户上下文 ---');
  const applicantRows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, 'm1_org_applicant'))
    .limit(1);
  const userId = applicantRows[0]?.id;
  if (!userId) {
    assert(false, 'm1_org_applicant 存在');
    console.log('');
    return;
  }

  const orgRows = await getDb()
    .select({ id: bizOrg.id })
    .from(bizOrg)
    .innerJoin(orgMember, eq(orgMember.orgId, bizOrg.id))
    .where(eq(orgMember.userId, userId))
    .limit(1);
  const orgId = orgRows[0]?.id;
  assert(orgId != null, '申请人有关联商户');

  if (orgId) {
    const role = await getOrgRoleForUser(userId, orgId);
    assert(role === OrgRole.OWNER, 'org-context 可解析 owner 角色');

    const alienRole = await getOrgRoleForUser(999999, orgId);
    assert(alienRole === null, '非成员无 org 角色');
  }
  console.log('');
}

async function main() {
  console.log('=== M1 Marketplace 供给入驻验收 ===\n');
  await checkSchemaAndI18n();
  await checkOrgOnboardFlow();
  await checkProviderOnboardFlow();
  await checkOrgContext();

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('M1 Marketplace 供给入驻验收全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error('[m1-marketplace-onboard-cases] 运行失败:', err);
  process.exit(1);
});
