import { eq, and } from 'drizzle-orm';
import {
  BizOrgStatus,
  BizOrgType,
  BudgetType,
  CertStatus,
  DemandStatus,
  MemberLevel,
  OrgRole,
  ProviderType,
  PublisherType,
  RoleCode,
  UserType,
} from '@douxing/shared';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema/users.js';
import { roles, userRoles } from '../../db/schema/index.js';
import { travelRoutes } from '../../db/schema/travel-routes.js';
import { bizOrg, orgMember } from '../../db/schema/marketplace-biz-org.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';
import { serviceDemand } from '../../db/schema/marketplace-demand.js';
import { isProductionEnv } from '../../utils/admin-password.util.js';
import { syncMerchantRoleForUser } from './marketplace-merchant-role.service.js';
import { generateDemandNo } from './marketplace-org.service.js';

const DEMO_ORG_NAME = '兜行演示旅行社';
const DEMO_DEMAND_TITLE = '杭州 3 日定制游（演示草稿）';

/** 演示商户登录账号（仅开发环境 seed） */
export const MERCHANT_DEMO_USERNAME = 'merchant';
/** 演示商户登录密码（仅开发环境 seed） */
export const MERCHANT_DEMO_PASSWORD = 'merchant123';
const MERCHANT_ORG_NAME = '云游旅行社（演示）';

/**
 * 写入模块 B 演示数据（幂等：已存在同名商户或同标题草稿时跳过）。
 *
 * @param demoUserId - demo 用户 ID；为空时尝试按用户名 `demo` 解析
 * @returns 是否新写入或已存在演示数据（`true` 表示库中已有可演示数据）
 */
export async function seedMarketplaceDemo(demoUserId?: number | null): Promise<boolean> {
  const db = getDb();
  let userId = demoUserId ?? null;

  if (userId == null) {
    const demoRows = await db.select({ id: users.id }).from(users).where(eq(users.username, 'demo')).limit(1);
    userId = demoRows[0]?.id ?? null;
  }

  if (userId == null) {
    console.log('[seed] marketplace: 无 demo 用户，跳过');
    return false;
  }

  const existingOrg = await db
    .select({ id: bizOrg.id })
    .from(bizOrg)
    .where(eq(bizOrg.name, DEMO_ORG_NAME))
    .limit(1);

  let orgId = existingOrg[0]?.id;

  if (!orgId) {
    const [orgResult] = await db.insert(bizOrg).values({
      name: DEMO_ORG_NAME,
      orgType: BizOrgType.TRAVEL_AGENCY,
      licenseNo: 'DEMO-LICENSE-001',
      status: BizOrgStatus.ACTIVE,
      settlementConfig: { platformFeeRate: 0.05, settlementCycleDays: 7 },
    });
    orgId = Number(orgResult.insertId);

    await db.insert(orgMember).values({
      userId,
      orgId,
      orgRole: OrgRole.OWNER,
    });
    console.log('[seed] marketplace: 创建演示旅行社');
  }

  const existingProvider = await db
    .select({ id: serviceProvider.id })
    .from(serviceProvider)
    .where(eq(serviceProvider.userId, userId))
    .limit(1);

  if (existingProvider.length === 0) {
    await db.insert(serviceProvider).values({
      userId,
      providerType: ProviderType.GUIDE,
      orgId,
      certStatus: CertStatus.APPROVED,
      creditScore: 100,
      categoryCodes: ['travel.guide', 'travel.custom_tour'],
      serviceRegions: ['杭州', '浙江'],
    });
    console.log('[seed] marketplace: 创建演示服务者');
  }

  const existingDemand = await db
    .select({ id: serviceDemand.id })
    .from(serviceDemand)
    .where(eq(serviceDemand.title, DEMO_DEMAND_TITLE))
    .limit(1);

  if (existingDemand.length === 0) {
    const routeRows = await db
      .select({ id: travelRoutes.id })
      .from(travelRoutes)
      .where(eq(travelRoutes.creatorId, userId))
      .limit(1);

    await db.insert(serviceDemand).values({
      demandNo: generateDemandNo(),
      publisherType: PublisherType.USER,
      publisherUserId: userId,
      categoryCode: 'travel.custom_tour',
      title: DEMO_DEMAND_TITLE,
      description: 'M0 演示草稿：个人定制杭州行程，可参考已保存 AI 路线。',
      destination: '杭州',
      budgetMin: '3000.00',
      budgetMax: '8000.00',
      budgetType: BudgetType.RANGE,
      status: DemandStatus.DRAFT,
      routeId: routeRows[0]?.id ?? null,
    });
    console.log('[seed] marketplace: 创建演示需求草稿');
  }

  return true;
}

/**
 * 创建或补全已入驻演示商户账号（幂等；生产环境跳过）。
 *
 * @returns 商户用户与组织 ID；生产环境或未创建时返回 null
 */
export async function seedMerchantPartnerUser(): Promise<{ userId: number; orgId: number } | null> {
  if (isProductionEnv()) {
    console.log('[seed] Production: skip merchant demo user (merchant/merchant123)');
    return null;
  }

  const db = getDb();

  let userId: number;
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, MERCHANT_DEMO_USERNAME))
    .limit(1);

  if (existingUser[0]) {
    userId = existingUser[0].id;
    console.log('[seed] marketplace: 演示商户账号已存在，校验入驻状态');
  } else {
    const hashed = await bcrypt.hash(MERCHANT_DEMO_PASSWORD, 10);
    const [userResult] = await db.insert(users).values({
      username: MERCHANT_DEMO_USERNAME,
      passwordHash: hashed,
      nickname: '演示商户',
      email: 'merchant@douxing.com',
      phone: '13800138001',
      userType: UserType.NORMAL,
      memberLevel: MemberLevel.SILVER,
      status: 1,
    });
    userId = Number(userResult.insertId);

    const userRoleRows = await db.select().from(roles).where(eq(roles.code, RoleCode.USER)).limit(1);
    if (userRoleRows[0]) {
      await db.insert(userRoles).values({ userId, roleId: userRoleRows[0].id });
    }
    console.log(`[seed] marketplace: 创建演示商户账号 (username: ${MERCHANT_DEMO_USERNAME}, password: ${MERCHANT_DEMO_PASSWORD})`);
  }

  const existingOrg = await db
    .select()
    .from(bizOrg)
    .where(eq(bizOrg.name, MERCHANT_ORG_NAME))
    .limit(1);

  let orgId: number;
  if (existingOrg[0]) {
    orgId = existingOrg[0].id;
    if (existingOrg[0].status !== BizOrgStatus.ACTIVE) {
      await db
        .update(bizOrg)
        .set({ status: BizOrgStatus.ACTIVE, reviewNote: null })
        .where(eq(bizOrg.id, orgId));
      console.log('[seed] marketplace: 已将演示商户组织状态更新为 active');
    }
  } else {
    const [orgResult] = await db.insert(bizOrg).values({
      name: MERCHANT_ORG_NAME,
      orgType: BizOrgType.TRAVEL_AGENCY,
      licenseNo: '91330100MA2XXXXXX',
      contactPhone: '13800138001',
      description: '演示用已入驻旅行社，可用于商户工作台接单报价联调。',
      status: BizOrgStatus.ACTIVE,
      settlementConfig: { platformFeeRate: 0.05, settlementCycleDays: 7 },
    });
    orgId = Number(orgResult.insertId);
    console.log('[seed] marketplace: 创建已入驻演示商户组织');
  }

  const memberRows = await db
    .select({ id: orgMember.id })
    .from(orgMember)
    .where(and(eq(orgMember.userId, userId), eq(orgMember.orgId, orgId)))
    .limit(1);

  if (memberRows.length === 0) {
    await db.insert(orgMember).values({
      userId,
      orgId,
      orgRole: OrgRole.OWNER,
    });
    console.log('[seed] marketplace: 绑定演示商户组织 Owner 成员关系');
  }

  const roleAssigned = await syncMerchantRoleForUser(userId);
  if (roleAssigned) {
    console.log('[seed] marketplace: 已为演示商户绑定 merchant 角色');
  }

  return { userId, orgId };
}
