/**
 * S2 · 动态菜单验收
 *
 * 用法：
 *   pnpm --filter @douxing/server s2:dynamic-menu-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import { RoleCode } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { roles, userRoles } from '../db/schema/index.js';
import { sysMenu } from '../db/schema/sys-admin.js';
import {
  getNavMenuTreeForUser,
  seedDefaultRoleMenus,
} from '../services/sys-admin.service.js';

let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function collectMenuKeys(nodes: { menuKey: string; children?: typeof nodes }[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    keys.push(node.menuKey);
    if (node.children?.length) {
      keys.push(...collectMenuKeys(node.children));
    }
  }
  return keys;
}

function collectPaths(nodes: { path?: string; children?: typeof nodes }[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.path) paths.push(node.path);
    if (node.children?.length) {
      paths.push(...collectPaths(node.children));
    }
  }
  return paths;
}

async function findUserIdByRole(roleCode: string): Promise<number | null> {
  const db = getDb();
  const roleRow = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleCode)).limit(1);
  const roleId = roleRow[0]?.id;
  if (!roleId) return null;
  const userRow = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId))
    .limit(1);
  return userRow[0]?.userId ?? null;
}

async function main() {
  console.log('=== S2 动态菜单验收 ===\n');
  await seedDefaultRoleMenus();

  const adminUserId = await findUserIdByRole(RoleCode.ADMIN);
  const operatorUserId = await findUserIdByRole(RoleCode.OPERATOR);
  const auditorUserId = await findUserIdByRole(RoleCode.AUDITOR);

  assert(Boolean(adminUserId), '存在 admin 用户');
  assert(Boolean(operatorUserId), '存在 operator 用户');
  assert(Boolean(auditorUserId), '存在 auditor 用户');

  const db = getDb();
  const menuCount = await db
    .select({ id: sysMenu.id })
    .from(sysMenu)
    .where(eq(sysMenu.menuType, 2));
  const navMenuCount = menuCount.length;

  if (adminUserId) {
    const adminTree = await getNavMenuTreeForUser(adminUserId);
    const adminKeys = collectMenuKeys(adminTree);
    assert(adminTree.length > 0, 'admin 导航树非空');
    assert(adminKeys.includes('home'), 'admin 含工作台');
    assert(adminKeys.includes('sys-users'), 'admin 含用户管理');
    assert(collectPaths(adminTree).includes('/routes'), 'admin 含 /routes 路径');
    assert(adminKeys.length >= navMenuCount, 'admin 可见菜单项不少于种子菜单数');
  }

  if (operatorUserId) {
    const operatorTree = await getNavMenuTreeForUser(operatorUserId);
    const operatorKeys = collectMenuKeys(operatorTree);
    assert(operatorKeys.includes('routes'), 'operator 含路线');
    assert(operatorKeys.includes('analytics'), 'operator 含数据分析');
    assert(!operatorKeys.includes('sys-users'), 'operator 不含用户管理');
    assert(!operatorKeys.includes('sys-roles'), 'operator 不含角色管理');
  }

  if (auditorUserId) {
    const auditorTree = await getNavMenuTreeForUser(auditorUserId);
    const auditorKeys = collectMenuKeys(auditorTree);
    assert(auditorKeys.includes('attractions-pending'), 'auditor 含景点审核');
    assert(!auditorKeys.includes('analytics'), 'auditor 不含数据分析');
    assert(!auditorKeys.includes('sys-users'), 'auditor 不含用户管理');
  }

  console.log('');
  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    return false;
  }
  console.log('S2 动态菜单验收全部通过');
  return true;
}

export async function runS2DynamicMenuCases(): Promise<boolean> {
  try {
    return await main();
  } catch (err) {
    console.error(err);
    return false;
  }
}

const isDirectRun = process.argv[1]?.includes('s2-dynamic-menu-cases');
if (isDirectRun) {
  runS2DynamicMenuCases().then((passed) => {
    if (!passed) process.exit(1);
  });
}
