<template>
  <SubPageShell
    :title="t('marketplace.createTitle')"
    :back-to="{ name: 'marketplace-hall' }"
    :back-label="t('marketplace.hallTitle')"
  >
    <form class="dx-card space-y-4" @submit.prevent="handleSubmit">
      <div v-if="fromRouteHint" class="rounded-lg bg-dx-primary/10 px-4 py-2 text-sm text-dx-primary">
        {{ fromRouteHint }}
      </div>
      <div>
        <label class="mb-1 block text-sm text-dx-muted">{{ t('marketplaceUi.fieldPublisherGroup') }}</label>
        <select v-model="publisherGroupId" class="dx-input w-full">
          <option :value="0">{{ t('marketplaceUi.pickGroup') }}</option>
          <option v-for="m in memberships" :key="m.groupId" :value="m.groupId">{{ m.group.name }}</option>
        </select>
      </div>
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
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { SERVICE_CATEGORY_TREE, type GroupMembershipSummary } from '@douxing/shared';
import { createMarketplaceDemand, publishMarketplaceDemand } from '@/api/marketplace';
import { fetchMyMarketplaceGroups } from '@/api/marketplace-groups';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const leafCategories = SERVICE_CATEGORY_TREE.flatMap((node) => node.children ?? []);
const title = ref('');
const categoryCode = ref(leafCategories[0]?.code ?? '');
const destination = ref('');
const description = ref('');
const budgetMin = ref('');
const budgetMax = ref('');
const publisherGroupId = ref(0);
const memberships = ref<GroupMembershipSummary[]>([]);
const submitting = ref(false);
const presetRouteId = ref<number | null>(null);
const fromRouteHint = ref('');

/**
 * 加载我的团体并应用 query 预选。
 */
async function loadGroups() {
  try {
    memberships.value = await fetchMyMarketplaceGroups();
    const gid = Number(route.query.groupId || 0);
    if (Number.isInteger(gid) && gid > 0 && memberships.value.some((m) => m.groupId === gid)) {
      publisherGroupId.value = gid;
    }
  } catch {
    memberships.value = [];
  }
}

/**
 * 从路由 query 读取路线预填参数（routeId / title / destination / budget / description）。
 */
function applyRoutePreset() {
  const rid = Number(route.query.routeId || 0);
  if (!Number.isInteger(rid) || rid <= 0) return;
  presetRouteId.value = rid;
  if (typeof route.query.title === 'string') title.value = route.query.title;
  if (typeof route.query.destination === 'string') destination.value = route.query.destination;
  if (typeof route.query.budgetMin === 'string') budgetMin.value = route.query.budgetMin;
  if (typeof route.query.budgetMax === 'string') budgetMax.value = route.query.budgetMax;
  if (typeof route.query.description === 'string') {
    description.value = route.query.description;
    fromRouteHint.value = t('marketplaceUi.fromRouteHint');
  }
}

/**
 * 提交草稿并发布需求。
 */
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
      publisherGroupId: publisherGroupId.value > 0 ? publisherGroupId.value : undefined,
      routeId: presetRouteId.value ?? undefined,
    });
    await publishMarketplaceDemand(draft.id);
    router.push({ name: 'marketplace-detail', params: { id: draft.id } });
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  applyRoutePreset();
  await loadGroups();
});
</script>
