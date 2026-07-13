<template>
  <SubPageShell
    :title="t('marketplace.createTitle')"
    :back-to="{ name: 'marketplace-hall' }"
    :back-label="t('marketplace.hallTitle')"
  >
    <form class="dx-card space-y-4" @submit.prevent="handleSubmit">
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldTitle') }}</label>
        <input v-model="title" class="dx-input w-full" :placeholder="t('marketplaceUi.titlePlaceholder')" />
      </div>
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldCategory') }}</label>
        <select v-model="categoryCode" class="dx-input w-full">
          <option v-for="cat in leafCategories" :key="cat.code" :value="cat.code">{{ t(cat.labelKey) }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldDestination') }}</label>
        <input v-model="destination" class="dx-input w-full" />
      </div>
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldDescription') }}</label>
        <textarea v-model="description" class="dx-input w-full min-h-24" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldBudgetMin') }}</label>
          <input v-model="budgetMin" class="dx-input w-full" type="number" />
        </div>
        <div>
          <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldBudgetMax') }}</label>
          <input v-model="budgetMax" class="dx-input w-full" type="number" />
        </div>
      </div>
      <button type="submit" class="dx-btn-primary w-full" :disabled="submitting">{{ t('marketplace.publish') }}</button>
    </form>
  </SubPageShell>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { SERVICE_CATEGORY_TREE } from '@douxing/shared';
import { createMarketplaceDemand, publishMarketplaceDemand } from '@/api/marketplace';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const router = useRouter();
const userStore = useUserStore();
const leafCategories = SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []);
const title = ref('');
const categoryCode = ref(leafCategories[0]?.code ?? '');
const destination = ref('');
const description = ref('');
const budgetMin = ref('');
const budgetMax = ref('');
const submitting = ref(false);

async function handleSubmit() {
  if (!userStore.token) {
    router.push({ name: 'login', query: { redirect: '/marketplace/create' } });
    return;
  }
  if (!title.value.trim()) return;
  submitting.value = true;
  try {
    const draft = await createMarketplaceDemand({
      categoryCode: categoryCode.value,
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      destination: destination.value.trim() || undefined,
      budgetMin: budgetMin.value || undefined,
      budgetMax: budgetMax.value || undefined,
      budgetType: budgetMin.value || budgetMax.value ? 'range' : undefined,
    });
    await publishMarketplaceDemand(draft.id);
    router.push({ name: 'marketplace-detail', params: { id: draft.id } });
  } finally {
    submitting.value = false;
  }
}
</script>
