import { computed } from 'vue';
import { RoleCode, type UserInfo } from '@douxing/shared';
import { useUserStore } from '@/stores/user';

/** 商户工作台权限前缀（与 sys_menu.perms 对齐） */
export const MERCHANT_PERM_PREFIX = 'marketplace:partner:';

/**
 * 判断用户是否具备管理端员工身份（admin、已分配菜单权限或商户角色权限）。
 *
 * @param user - 用户信息；为空时返回 `false`
 * @returns 是否为管理端可登录用户
 */
export function isStaffUser(user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const permissions = user.permissions ?? [];
  return roles.includes(RoleCode.ADMIN) || permissions.length > 0;
}

/**
 * 判断权限列表是否均为商户工作台权限。
 *
 * @param permissions - 用户权限码列表
 * @returns 全部为商户权限且非空时为 true
 */
export function isMerchantOnlyPermissions(permissions: string[]): boolean {
  if (permissions.length === 0) return false;
  return permissions.every((perm) => perm.startsWith(MERCHANT_PERM_PREFIX));
}

export function usePermissions() {
  const userStore = useUserStore();

  const permissions = computed(() => userStore.user?.permissions ?? []);
  const roles = computed(() => userStore.user?.roles ?? []);
  const isAdmin = computed(() => roles.value.includes(RoleCode.ADMIN));
  const isStaff = computed(() => isStaffUser(userStore.user));
  const isMerchantUser = computed(() =>
    permissions.value.some((perm) => perm.startsWith(MERCHANT_PERM_PREFIX)),
  );
  const isMerchantOnly = computed(() => isMerchantOnlyPermissions(permissions.value));

  function hasPerm(perm: string | undefined): boolean {
    if (!perm) return isStaff.value;
    if (isAdmin.value) return true;
    return permissions.value.includes(perm);
  }

  function hasAnyPerm(perms: string[]): boolean {
    if (isAdmin.value) return true;
    return perms.some((perm) => permissions.value.includes(perm));
  }

  return { permissions, roles, isAdmin, isStaff, isMerchantUser, isMerchantOnly, hasPerm, hasAnyPerm };
}
