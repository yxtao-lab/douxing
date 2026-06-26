import { computed } from 'vue';
import { RoleCode } from '@douxing/shared';
import { useUserStore } from '@/stores/user';

export function usePermissions() {
  const userStore = useUserStore();

  const permissions = computed(() => userStore.user?.permissions ?? []);
  const roles = computed(() => userStore.user?.roles ?? []);
  const isAdmin = computed(() => roles.value.includes(RoleCode.ADMIN));
  const isStaff = computed(() => isAdmin.value || permissions.value.length > 0);

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
