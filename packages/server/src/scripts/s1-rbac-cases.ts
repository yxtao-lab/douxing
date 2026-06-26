/**
 * S1 · RBAC 闭环验收
 *
 * 用法：
 *   pnpm --filter @douxing/server s1:rbac-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import { RoleCode } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { roles, userRoles } from '../db/schema/index.js';
import { roleMenu, sysMenu } from '../db/schema/sys-admin.js';
import {
  DEFAULT_ROLE_MENU_KEYS,
  getRoleMenuIds,
  seedDefaultRoleMenus,
} from '../services/sys-admin.service.js';
import {
  getPermissionsForUser,
  hasPermission,
  isAdminRole,
} from '../services/permission.service.js';
import { getUserWithRoles } from '../services/user.service.js';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

async function main() {
  console.log('=== S1 RBAC 验收 ===\n');
  const db = getDb();

  const roleRows = await db.select().from(roles);
  const roleIdByCode = new Map(roleRows.map((row) => [row.code, row.id]));

  assert(roleIdByCode.has(RoleCode.ADMIN), '存在 admin 角色');
  assert(roleIdByCode.has(RoleCode.OPERATOR), '存在 operator 角色');
  assert(roleIdByCode.has(RoleCode.AUDITOR), '存在 auditor 角色');

  const menuCount = await db.select({ id: sysMenu.id }).from(sysMenu);
  assert(menuCount.length > 0, 'sys_menu 已种子化');

  await seedDefaultRoleMenus();

  const adminRoleId = roleIdByCode.get(RoleCode.ADMIN)!;
  const operatorRoleId = roleIdByCode.get(RoleCode.OPERATOR)!;
  const auditorRoleId = roleIdByCode.get(RoleCode.AUDITOR)!;

  const adminMenuIds = await getRoleMenuIds(adminRoleId);
  assert(adminMenuIds.length === menuCount.length, 'admin 绑定全部菜单');

  const operatorMenuIds = await getRoleMenuIds(operatorRoleId);
  const auditorMenuIds = await getRoleMenuIds(auditorRoleId);
  assert(operatorMenuIds.length > 0, 'operator 已绑定菜单');
  assert(auditorMenuIds.length > 0, 'auditor 已绑定菜单');
  assert(operatorMenuIds.length > auditorMenuIds.length, 'operator 菜单多于 auditor');

  const operatorKeys = DEFAULT_ROLE_MENU_KEYS[RoleCode.OPERATOR];
  assert(Array.isArray(operatorKeys), 'operator 默认菜单键已定义');

  const adminUserRole = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, adminRoleId))
    .limit(1);
  const adminUserId = adminUserRole[0]?.userId;
  assert(Boolean(adminUserId), '存在 admin 用户');

  if (adminUserId) {
    const adminInfo = await getUserWithRoles(adminUserId);
    assert(Boolean(adminInfo?.permissions.length), 'admin /auth/me 含 permissions');
    assert(isAdminRole(adminInfo!.roles), 'admin 角色识别');
    assert(
      hasPermission(adminInfo!.roles, adminInfo!.permissions, 'system:user:list'),
      'admin 拥有 system:user:list',
    );
  }

  const operatorPerms = await db
    .select({ perms: sysMenu.perms })
    .from(roleMenu)
    .innerJoin(sysMenu, eq(roleMenu.menuId, sysMenu.id))
    .where(eq(roleMenu.roleId, operatorRoleId));
  const operatorPermSet = new Set(
    operatorPerms.map((row) => row.perms).filter((p): p is string => Boolean(p)),
  );
  assert(operatorPermSet.has('biz:routes:list'), 'operator 含 biz:routes:list');
  assert(!operatorPermSet.has('system:user:list'), 'operator 不含 system:user:list');

  const auditorPerms = await db
    .select({ perms: sysMenu.perms })
    .from(roleMenu)
    .innerJoin(sysMenu, eq(roleMenu.menuId, sysMenu.id))
    .where(eq(roleMenu.roleId, auditorRoleId));
  const auditorPermSet = new Set(
    auditorPerms.map((row) => row.perms).filter((p): p is string => Boolean(p)),
  );
  assert(auditorPermSet.has('content:attractions:pending'), 'auditor 含景点审核');
  assert(auditorPermSet.has('biz:orders:list'), 'auditor 含订单只读');
  assert(!auditorPermSet.has('data:analytics:view'), 'auditor 不含数据分析');

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    return false;
  }
  console.log('S1 RBAC 验收全部通过');
  return true;
}

export async function runS1RbacCases(): Promise<boolean> {
  try {
    return await main();
  } catch (err) {
    console.error(err);
    return false;
  }
}

const isDirectRun = process.argv[1]?.includes('s1-rbac-cases');
if (isDirectRun) {
  runS1RbacCases().then((passed) => {
    if (!passed) process.exit(1);
  });
}
