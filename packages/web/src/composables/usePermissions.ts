import { computed } from 'vue';
import { RoleCode, type UserInfo } from '@douxing/shared';
import { useUserStore } from '@/stores/user';

/**
 * 判断用户是否具备管理端员工身份（admin 或已分配权限）。
 *
 * @param user - 用户信息；为空时返回 `false`
 * @returns 是否为管理端可登录员工
 */
export function isStaffUser(user: UserInfo | null | undefined): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const permissions = user.permissions ?? [];
  return roles.includes(RoleCode.ADMIN) || permissions.length > 0;
}

export function usePermissions() {
  const userStore = useUserStore();

  const permissions = computed(() => userStore.user?.permissions ?? []);
  const roles = computed(() => userStore.user?.roles ?? []);
  const isAdmin = computed(() => roles.value.includes(RoleCode.ADMIN));
  const isStaff = computed(() => isStaffUser(userStore.user));

  function hasPerm(perm: string | undefined): boolean {
    if (!perm) return isStaff.value;
    if (isAdmin.value) return true;
    return permissions.value.includes(perm);
  }

  function hasAnyPerm(perms: string[]): boolean {
    if (isAdmin.value) return true;
    return perms.some((perm) => permissions.value.includes(perm));
  }

  return { permissions, roles, isAdmin, isStaff, hasPerm, hasAnyPerm };
}
