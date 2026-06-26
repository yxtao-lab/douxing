import { and, eq, inArray } from 'drizzle-orm';
import { RoleCode } from '@douxing/shared';
import { getDb } from '../db/client.js';
import { roles, userRoles } from '../db/schema/index.js';
import { roleMenu, sysMenu } from '../db/schema/sys-admin.js';

/** 超级管理员角色 bypass 全部 perms 校验 */
export function isAdminRole(roleCodes: string[]): boolean {
  return roleCodes.includes(RoleCode.ADMIN);
}

export function hasPermission(
  roleCodes: string[],
  permissions: string[],
  required: string | string[],
): boolean {
  if (isAdminRole(roleCodes)) return true;
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.some((perm) => permissions.includes(perm));
}

/** 是否可进入 Web 管理端（至少一项菜单权限或 admin 角色） */
export function canAccessAdminPanel(roleCodes: string[], permissions: string[]): boolean {
  if (isAdminRole(roleCodes)) return true;
  return permissions.length > 0;
}

export async function getAllMenuPermissions(): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ perms: sysMenu.perms })
    .from(sysMenu)
    .where(eq(sysMenu.status, 1));
  const set = new Set<string>();
  for (const row of rows) {
    if (row.perms) set.add(row.perms);
  }
  return [...set];
}

export async function getPermissionsForUser(userId: number): Promise<string[]> {
  const db = getDb();
  const roleRows = await db
    .select({ code: roles.code, roleId: roles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  if (roleRows.some((row) => row.code === RoleCode.ADMIN)) {
    return getAllMenuPermissions();
  }

  const roleIds = roleRows.map((row) => row.roleId);
  if (roleIds.length === 0) return [];

  const permRows = await db
    .select({ perms: sysMenu.perms })
    .from(roleMenu)
    .innerJoin(sysMenu, eq(roleMenu.menuId, sysMenu.id))
    .where(inArray(roleMenu.roleId, roleIds));

  const set = new Set<string>();
  for (const row of permRows) {
    if (row.perms) set.add(row.perms);
  }
  return [...set];
}

/** 用户可访问的菜单 id（含 role_menu 分配项及其祖先目录） */
export async function getAccessibleMenuIdsForUser(userId: number): Promise<Set<number>> {
  const db = getDb();
  const roleRows = await db
    .select({ code: roles.code, roleId: roles.id })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const roleCodes = roleRows.map((row) => row.code);
  let assignedIds: Set<number>;

  if (isAdminRole(roleCodes)) {
    const allRows = await db.select({ id: sysMenu.id }).from(sysMenu);
    assignedIds = new Set(allRows.map((row) => row.id));
  } else {
    const roleIds = roleRows.map((row) => row.roleId);
    if (roleIds.length === 0) return new Set();
    const menuRows = await db
      .select({ menuId: roleMenu.menuId })
      .from(roleMenu)
      .where(inArray(roleMenu.roleId, roleIds));
    assignedIds = new Set(menuRows.map((row) => row.menuId));
  }

  if (assignedIds.size === 0) return assignedIds;

  const navRows = await db
    .select({ id: sysMenu.id, parentId: sysMenu.parentId })
    .from(sysMenu)
    .where(and(eq(sysMenu.visible, 1), eq(sysMenu.status, 1)));
  const parentById = new Map(navRows.map((row) => [row.id, row.parentId]));

  const expanded = new Set(assignedIds);
  for (const id of assignedIds) {
    let parentId = parentById.get(id);
    while (parentId != null && parentId > 0) {
      expanded.add(parentId);
      parentId = parentById.get(parentId);
    }
  }
  return expanded;
}

export async function userHasPermission(
  userId: number,
  required: string | string[],
): Promise<boolean> {
  const db = getDb();
  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  const roleCodes = roleRows.map((row) => row.code);
  if (isAdminRole(roleCodes)) return true;
  const permissions = await getPermissionsForUser(userId);
  return hasPermission(roleCodes, permissions, required);
}
