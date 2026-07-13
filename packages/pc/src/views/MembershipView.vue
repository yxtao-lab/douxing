<template>
  <SubPageShell
    :title="t('nav.membership')"
    :description="t('membership.upgradeHint')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="membership" class="space-y-6">
      <div class="dx-card flex items-center gap-4 bg-dx-primary-light">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-dx-primary text-2xl text-white">
          💎
        </div>
        <div>
          <p class="text-sm text-dx-muted">{{ t('membership.currentLevel') }}</p>
          <p class="text-xl font-bold text-dx-text">{{ levelLabel(membership.level) }}</p>
          <p class="text-sm text-dx-muted">{{ currentSummary }}</p>
          <p v-if="expiresText" class="mt-1 text-sm text-dx-muted">{{ expiresText }}</p>
          <p v-if="membership.isExpired" class="mt-1 text-sm text-red-600">{{ t('membership.expiredHint') }}</p>
        </div>
      </div>

      <div class="dx-card overflow-x-auto">
        <h3 class="mb-3 text-base font-semibold text-dx-text">{{ t('membership.compareTitle') }}</h3>
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-dx-border text-left">
              <th class="py-3 pr-4 font-medium">{{ t('membership.featureColumn') }}</th>
              <th
                v-for="tier in tiers"
                :key="tier.level"
                class="px-3 py-3 font-medium"
                :class="{ 'bg-dx-primary-light text-dx-primary': tier.level === membership.level }"
              >
                {{ levelLabel(tier.level) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-dx-border">
              <td class="py-3 pr-4">{{ t('membership.featurePlanCount') }}</td>
              <td
                v-for="tier in tiers"
                :key="`c-${tier.level}`"
                class="px-3 py-3"
                :class="{ 'bg-dx-primary-light font-medium text-dx-primary': tier.level === membership.level }"
              >
                {{ t('membership.planCountUnit', { count: tier.planCandidateCount }) }}
              </td>
            </tr>
            <tr>
              <td class="py-3 pr-4">{{ t('membership.featureFollowUp') }}</td>
              <td
                v-for="tier in tiers"
                :key="`f-${tier.level}`"
                class="px-3 py-3"
                :class="{ 'bg-dx-primary-light font-medium text-dx-primary': tier.level === membership.level }"
              >
                {{ tier.canAppendPlan ? t('membership.followUpYes') : t('membership.followUpNo') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="upgradeProducts.length > 0" class="dx-card space-y-4">
        <h3 class="text-base font-semibold text-dx-text">{{ t('membership.upgradeTitle') }}</h3>
        <div
          v-for="product in upgradeProducts"
          :key="product.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dx-border p-4"
        >
          <div class="flex items-center gap-3">
            <span class="text-2xl">{{ levelIcon(product.targetLevel) }}</span>
            <div>
              <p class="font-semibold text-dx-text">{{ levelLabel(product.targetLevel) }}</p>
              <p class="text-sm text-dx-primary">
                {{ t('membership.priceUnit', { price: product.price }) }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="dx-btn-primary !px-4 !py-2 text-sm"
            :disabled="payingLevel != null"
            @click="handleUpgrade(product.targetLevel)"
          >
            {{ payingLevel === product.targetLevel ? t('common.loading') : upgradeButtonText(product.targetLevel) }}
          </button>
        </div>
        <p class="text-center text-xs text-dx-muted">{{ t('membership.upgradePayMock') }}</p>
      </div>
    </div>
    <div v-else class="dx-card text-center text-dx-muted">{{ t('membership.loadFailed') }}</div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { MembershipInfo, MembershipProduct } from '@douxing/shared';
import {
  getAllMembershipTiers,
  formatDisplayDateTime,
  getMemberLevelI18nKey,
  getMemberLevelIcon,
  MEMBERSHIP_PRODUCTS,
} from '@douxing/shared';
import { completeMembershipUpgradePayment, fetchMembershipInfoDirect } from '@/api/membership';
import SubPageShell from '@/components/SubPageShell.vue';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const { t } = useLocale();
const loading = ref(true);
const membership = ref<MembershipInfo | null>(null);
const payingLevel = ref<number | null>(null);

const tiers = getAllMembershipTiers().map((tier) => ({
  level: tier.level,
  planCandidateCount: tier.planCandidateCount,
  canAppendPlan: tier.canAppendPlan,
}));

const upgradeProducts = computed<MembershipProduct[]>(() => {
  if (!membership.value) return [];
  const effective = membership.value.level;
  const stored = membership.value.storedLevel;
  return MEMBERSHIP_PRODUCTS.filter((product) => {
    if (product.targetLevel > effective) return true;
    return product.targetLevel === stored && stored > 0;
  });
});

const expiresText = computed(() => {
  if (!membership.value?.memberExpiresAt || membership.value.level <= 0) return '';
  const date = formatDisplayDateTime(membership.value.memberExpiresAt);
  return t('membership.expiresAt', { date });
});

function levelLabel(level?: number) {
  return t(getMemberLevelI18nKey(level));
}

function levelIcon(level: number) {
  return getMemberLevelIcon(level);
}

function upgradeButtonText(targetLevel: number): string {
  if (!membership.value) return t('membership.upgrade');
  if (targetLevel === membership.value.level) return t('membership.renew');
  return t('membership.upgrade');
}

const currentSummary = computed(() => {
  if (!membership.value) return '';
  const followUp = membership.value.canAppendPlan
    ? t('membership.followUpYes')
    : t('membership.followUpNo');
  return `${t('membership.featurePlanCount')}：${t('membership.planCountUnit', { count: membership.value.planCandidateCount })} · ${t('membership.featureFollowUp')}：${followUp}`;
});

async function loadMembership() {
  membership.value = await fetchMembershipInfoDirect();
}

async function handleUpgrade(targetLevel: number) {
  payingLevel.value = targetLevel;
  try {
    await completeMembershipUpgradePayment(targetLevel);
    appMessage.success(t('membership.upgradeSuccess'));
    await loadMembership();
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('membership.upgradeFailed')));
  } finally {
    payingLevel.value = null;
  }
}

onMounted(async () => {
  try {
    await loadMembership();
  } catch {
    membership.value = null;
  } finally {
    loading.value = false;
  }
});
</script>
