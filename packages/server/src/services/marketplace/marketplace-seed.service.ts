import { eq } from 'drizzle-orm';
import {
  BizOrgStatus,
  BizOrgType,
  BudgetType,
  CertStatus,
  DemandStatus,
  OrgRole,
  ProviderType,
  PublisherType,
} from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { users } from '../../db/schema/users.js';
import { travelRoutes } from '../../db/schema/travel-routes.js';
import { bizOrg, orgMember } from '../../db/schema/marketplace-biz-org.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';
import { serviceDemand } from '../../db/schema/marketplace-demand.js';
import { generateDemandNo } from './marketplace-org.service.js';

const DEMO_ORG_NAME = '兜行演示旅行社';
const DEMO_DEMAND_TITLE = '杭州 3 日定制游（演示草稿）';

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
