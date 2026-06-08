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
        </div>
      </div>

      <div class="dx-card overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="border-b border-dx-border text-left">
              <th class="py-3 pr-4 font-medium">{{ t('membership.featureColumn') }}</th>
              <th v-for="tier in tiers" :key="tier.level" class="px-3 py-3 font-medium">{{ levelLabel(tier.level) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="border-b border-dx-border">
              <td class="py-3 pr-4">{{ t('membership.featurePlanCount') }}</td>
              <td v-for="tier in tiers" :key="`c-${tier.level}`" class="px-3 py-3">
                {{ t('membership.planCountUnit', { count: tier.planCandidateCount }) }}
              </td>
            </tr>
            <tr>
              <td class="py-3 pr-4">{{ t('membership.featureFollowUp') }}</td>
              <td v-for="tier in tiers" :key="`f-${tier.level}`" class="px-3 py-3">
                {{ tier.canAppendPlan ? t('membership.followUpYes') : t('membership.followUpNo') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { MembershipInfo } from '@douxing/shared';
import {
  canAppendPlanByMemberLevel,
  getMemberLevelI18nKey,
  getPlanCandidateCountByMemberLevel,
} from '@douxing/shared';
import { fetchMembershipInfo } from '@/api/user';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';

const { t } = useLocale();
const loading = ref(true);
const membership = ref<MembershipInfo | null>(null);

const tiers = [0, 1, 2, 3].map((level) => ({
  level,
  planCandidateCount: getPlanCandidateCountByMemberLevel(level),
  canAppendPlan: canAppendPlanByMemberLevel(level),
}));

function levelLabel(level?: number) {
  return t(getMemberLevelI18nKey(level));
}

const currentSummary = computed(() => {
  if (!membership.value) return '';
  const tier = tiers.find((item) => item.level === membership.value!.level) ?? tiers[0]!;
  return `${t('membership.featurePlanCount')}：${t('membership.planCountUnit', { count: tier.planCandidateCount })} · ${t('membership.featureFollowUp')}：${tier.canAppendPlan ? t('membership.followUpYes') : t('membership.followUpNo')}`;
});

onMounted(async () => {
  try {
    membership.value = await fetchMembershipInfo();
  } finally {
    loading.value = false;
  }
});
</script>
