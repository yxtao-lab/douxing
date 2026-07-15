<template>
  <SubPageShell
    :title="t('marketplace.groupsTitle')"
    :description="t('marketplaceUi.groupsDesc')"
    :back-to="{ name: 'marketplace-hall' }"
    :back-label="t('marketplace.hallTitle')"
  >
    <div class="mb-4 flex justify-end gap-2">
      <RouterLink :to="{ name: 'marketplace-group-create' }" class="dx-btn-primary text-sm">
        {{ t('marketplace.groupCreateTitle') }}
      </RouterLink>
    </div>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="items.length === 0" class="dx-card text-center text-dx-muted">
      {{ t('marketplaceUi.emptyGroups') }}
    </div>
    <div v-else class="space-y-3">
      <RouterLink
        v-for="item in items"
        :key="item.groupId"
        :to="{ name: 'marketplace-group-detail', params: { id: item.groupId } }"
        class="dx-card block transition-shadow hover:shadow-md"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="font-semibold text-dx-text">{{ item.group.name }}</h3>
          <span class="rounded-full bg-dx-primary/10 px-2 py-0.5 text-xs text-dx-primary">
            {{ memberRoleLabel(item.memberRole) }}
          </span>
        </div>
        <p class="mt-1 text-sm text-dx-muted">{{ groupTypeLabel(item.group.groupType) }}</p>
        <p v-if="item.group.headcount" class="text-sm text-dx-muted">
          {{ t('marketplaceUi.fieldHeadcount') }}：{{ item.group.headcount }}
        </p>
      </RouterLink>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { GroupMembershipSummary } from '@douxing/shared';
import { fetchMyMarketplaceGroups } from '@/api/marketplace-groups';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const loading = ref(false);
const items = ref<GroupMembershipSummary[]>([]);

/**
 * 解析团体类型展示名。
 *
 * @param type - 团体类型
 * @returns 本地化标签
 */
function groupTypeLabel(type: string) {
  const key = `marketplace.groupType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

/**
 * 解析成员角色展示名。
 *
 * @param role - 成员角色
 * @returns 本地化标签
 */
function memberRoleLabel(role: string) {
  const key = `marketplace.memberRole.${role}`;
  const label = t(key);
  return label !== key ? label : role;
}

/**
 * 加载我的团体列表。
 */
async function load() {
  loading.value = true;
  try {
    items.value = await fetchMyMarketplaceGroups();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
