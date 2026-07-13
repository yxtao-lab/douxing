import { and, eq } from 'drizzle-orm';
import { RoleCode } from '@douxing/shared';
import { getDb } from '../../db/client.js';
import { roles, userRoles } from '../../db/schema/index.js';
import { orgMember } from '../../db/schema/marketplace-biz-org.js';
import { serviceProvider } from '../../db/schema/marketplace-provider.js';

/**
 * 判断用户是否已有 marketplace 供给侧关联（商户成员或个人服务者档案）。
 *
 * @param userId - 用户 ID
 * @returns 存在任一关联时为 true
 */
export async function userHasMarketplacePartnerProfile(userId: number): Promise<boolean> {
  const db = getDb();
  const [orgRows, providerRows] = await Promise.all([
    db.select({ id: orgMember.orgId }).from(orgMember).where(eq(orgMember.userId, userId)).limit(1),
    db
      .select({ id: serviceProvider.id })
      .from(serviceProvider)
      .where(eq(serviceProvider.userId, userId))
      .limit(1),
  ]);
  return orgRows.length > 0 || providerRows.length > 0;
}

/**
 * 为用户绑定商户角色（幂等，不重复插入 user_roles）。
 *
 * @param userId - 用户 ID
 * @returns 是否新绑定了商户角色
 */
async function assignMerchantRoleIfMissing(userId: number): Promise<boolean> {
  const db = getDb();
  const merchantRoleRows = await db.select().from(roles).where(eq(roles.code, RoleCode.MERCHANT)).limit(1);
  const merchantRole = merchantRoleRows[0];
  if (!merchantRole) return false;

  const existing = await db
    .select({ roleId: userRoles.roleId })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, merchantRole.id)))
    .limit(1);
  if (existing[0]) return false;

  await db.insert(userRoles).values({ userId, roleId: merchantRole.id });
  return true;
}

/**
 * 若用户已提交入驻/认证，则同步商户角色（登录与 /me 时调用）。
 *
 * @param userId - 用户 ID
 * @returns 是否在本轮新绑定了商户角色
 */
export async function syncMerchantRoleForUser(userId: number): Promise<boolean> {
  const eligible = await userHasMarketplacePartnerProfile(userId);
  if (!eligible) return false;
  return assignMerchantRoleIfMissing(userId);
}

/**
 * 开通商户管理端访问：绑定商户角色，供尚未入驻但需从 Web 提交申请的用户使用。
 *
 * @param userId - 用户 ID
 * @returns 是否在本轮新绑定了商户角色
 */
export async function enrollMerchantAdminAccess(userId: number): Promise<boolean> {
  return assignMerchantRoleIfMissing(userId);
}

/**
 * 确保预置「商户」角色存在于 roles 表（迁移/启动时调用）。
 *
 * @returns 无返回值
 */
export async function ensureMerchantRoleSeed(): Promise<void> {
  const db = getDb();
  const existing = await db.select().from(roles).where(eq(roles.code, RoleCode.MERCHANT)).limit(1);
  if (existing[0]) return;
  await db.insert(roles).values({
    code: RoleCode.MERCHANT,
    name: '商户',
    description: '发单接单商户与个人服务者，仅可访问商户工作台菜单',
  });
  console.log('[seed] Inserted role: merchant');
}
