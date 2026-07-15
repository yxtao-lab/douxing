<template>
  <SubPageShell
    :title="t('marketplace.groupCreateTitle')"
    :description="t('marketplaceUi.groupCreateDesc')"
    :back-to="{ name: 'marketplace-groups' }"
    :back-label="t('marketplace.groupsTitle')"
  >
    <form class="dx-card space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldGroupName') }}</label>
        <input v-model="name" class="dx-input w-full" :placeholder="t('marketplaceUi.groupNamePlaceholder')" />
      </div>
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldGroupType') }}</label>
        <select v-model="groupType" class="dx-input w-full">
          <option v-for="type in DEMAND_GROUP_TYPES" :key="type" :value="type">
            {{ t(`marketplace.groupType.${type}`) }}
          </option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldHeadcount') }}</label>
        <input
          v-model="headcount"
          class="dx-input w-full"
          type="number"
          min="1"
          :placeholder="t('marketplaceUi.headcountPlaceholder')"
        />
      </div>
      <button type="submit" class="dx-btn-primary w-full" :disabled="submitting">
        {{ t('marketplaceUi.groupCreateSubmit') }}
      </button>
    </form>
  </SubPageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { DEMAND_GROUP_TYPES, DemandGroupType } from '@douxing/shared';
import { createMarketplaceGroup } from '@/api/marketplace-groups';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const name = ref('');
const groupType = ref<(typeof DEMAND_GROUP_TYPES)[number]>(DemandGroupType.COMPANY);
const headcount = ref('');
const submitting = ref(false);

/**
 * 提交创建团体。
 */
async function handleSubmit() {
  if (!userStore.token) {
    router.push({ name: 'login', query: { redirect: '/marketplace/groups/create' } });
    return;
  }
  if (!name.value.trim()) return;
  const hc = headcount.value.trim() ? Number(headcount.value) : undefined;
  if (hc != null && (!Number.isInteger(hc) || hc < 1)) return;
  submitting.value = true;
  try {
    const group = await createMarketplaceGroup({
      name: name.value.trim(),
      groupType: groupType.value,
      headcount: hc,
    });
    router.push({ name: 'marketplace-group-detail', params: { id: group.id } });
  } finally {
    submitting.value = false;
  }
}
</script>
