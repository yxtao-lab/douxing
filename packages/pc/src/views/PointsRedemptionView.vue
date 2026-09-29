<template>
  <SubPageShell
    :title="t('pointsRedemption.title')"
    :description="t('pointsRedemption.hint')"
    :back-to="{ name: 'verification-points' }"
    :back-label="t('verificationPoints.title')"
  >
    <div class="mb-6 rounded-2xl bg-gradient-to-br from-teal-700 to-teal-900 p-6 text-white shadow-lg">
      <p class="text-sm text-white/80">{{ t('pointsRedemption.balanceLabel') }}</p>
      <p class="mt-1 text-3xl font-bold text-teal-100">
        {{ t('pointsRedemption.balance', { points: entitlements?.balance ?? 0 }) }}
      </p>
      <div class="mt-3 flex flex-wrap gap-2 text-xs text-teal-50/90">
        <span class="rounded-full bg-white/10 px-3 py-1">
          {{
            t('pointsRedemption.planBonus', {
              bonus: entitlements?.bonusPlanCandidates ?? 0,
              total: entitlements?.effectivePlanCandidates ?? 0,
            })
          }}
        </span>
        <span class="rounded-full bg-white/10 px-3 py-1">
          {{ t('pointsRedemption.photoBonus', { count: entitlements?.bonusPhotoCount ?? 0 }) }}
        </span>
        <span
          v-if="entitlements?.posterStickerUnlocked"
          class="rounded-full bg-white/10 px-3 py-1"
        >
          {{ t('pointsRedemption.stickerOwned') }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="py-12 text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else class="space-y-3">
      <div
        v-for="item in catalog"
        :key="item.id"
        class="flex items-center gap-4 rounded-2xl border border-dx-border bg-white p-4"
      >
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-dx-text">{{ productTitle(item.id) }}</h3>
          <p class="mt-1 text-sm text-dx-muted">{{ productDesc(item) }}</p>
          <p class="mt-2 text-sm font-medium text-teal-700">
            {{ t('pointsRedemption.cost', { points: item.costPoints }) }}
          </p>
        </div>
        <button
          type="button"
          class="dx-btn-primary shrink-0 disabled:opacity-40"
          :disabled="!item.canRedeem || redeemingId === item.id"
          @click="handleRedeem(item)"
        >
          {{ redeemButtonLabel(item) }}
        </button>
      </div>
    </div>

    <section v-if="history.length" class="mt-8">
      <h2 class="mb-3 text-base font-semibold text-dx-text">
        {{ t('pointsRedemption.historyTitle') }}
      </h2>
      <ul class="divide-y divide-dx-border rounded-2xl border border-dx-border bg-white">
        <li v-for="row in history" :key="row.id" class="flex justify-between gap-3 px-4 py-3 text-sm">
          <span class="text-dx-text">{{ productTitle(row.productId) }}</span>
          <span class="text-dx-muted">-{{ row.pointsSpent }} · {{ row.createdAt }}</span>
        </li>
      </ul>
    </section>
  </SubPageShell>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type {
  PointRedemptionCatalogItem,
  PointRedemptionEntitlements,
  PointRedemptionRecord,
} from '@douxing/shared';
import { PointRedemptionProductId } from '@douxing/shared';
import { fetchRedemptionCatalog, fetchRedemptionHistory, redeemPoints } from '@/api/user';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';
import { appMessage } from '@/composables/useAppMessage';

const { t } = useLocale();

const loading = ref(true);
const redeemingId = ref('');
const catalog = ref<PointRedemptionCatalogItem[]>([]);
const entitlements = ref<PointRedemptionEntitlements | null>(null);
const history = ref<PointRedemptionRecord[]>([]);

/**
 * 商品标题。
 *
 * @param id - 商品 ID
 * @returns 文案
 */
function productTitle(id: string) {
  const map: Record<string, string> = {
    [PointRedemptionProductId.AI_PLAN_PACK]: t('pointsRedemption.productAiPlan'),
    [PointRedemptionProductId.PHOTO_QUOTA_PACK]: t('pointsRedemption.productPhoto'),
    [PointRedemptionProductId.MEMBER_TRIAL_SILVER]: t('pointsRedemption.productMember'),
    [PointRedemptionProductId.POSTER_STICKER]: t('pointsRedemption.productSticker'),
  };
  return map[id] ?? id;
}

/**
 * 商品说明。
 *
 * @param item - 目录项
 * @returns 文案
 */
function productDesc(item: PointRedemptionCatalogItem) {
  if (item.id === PointRedemptionProductId.AI_PLAN_PACK) {
    return t('pointsRedemption.descAiPlan', { n: item.grantPlanCandidates ?? 1 });
  }
  if (item.id === PointRedemptionProductId.PHOTO_QUOTA_PACK) {
    return t('pointsRedemption.descPhoto', { count: item.grantPhotoCount ?? 100 });
  }
  if (item.id === PointRedemptionProductId.MEMBER_TRIAL_SILVER) {
    return t('pointsRedemption.descMember', { days: item.grantMemberDays ?? 7 });
  }
  return t('pointsRedemption.descSticker');
}

/**
 * 兑换按钮文案。
 *
 * @param item - 目录项
 * @returns 文案
 */
function redeemButtonLabel(item: PointRedemptionCatalogItem) {
  if (redeemingId.value === item.id) return t('pointsRedemption.redeeming');
  if (item.canRedeem) return t('pointsRedemption.redeem');
  if (item.blockedReason === 'insufficient') return t('pointsRedemption.insufficient');
  if (item.blockedReason === 'already_owned') return t('pointsRedemption.owned');
  if (item.blockedReason === 'member_not_eligible') return t('pointsRedemption.memberBlock');
  if (item.blockedReason === 'limit') return t('pointsRedemption.limit');
  return t('pointsRedemption.unavailable');
}

/**
 * 加载目录与历史。
 */
async function load() {
  loading.value = true;
  try {
    const [catalogRes, historyRes] = await Promise.all([
      fetchRedemptionCatalog(),
      fetchRedemptionHistory(10),
    ]);
    catalog.value = catalogRes.catalog;
    entitlements.value = catalogRes.entitlements;
    history.value = historyRes.items;
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('pointsRedemption.loadFailed')));
  } finally {
    loading.value = false;
  }
}

/**
 * 兑换商品。
 *
 * @param item - 目录项
 */
async function handleRedeem(item: PointRedemptionCatalogItem) {
  if (!item.canRedeem || redeemingId.value) return;
  redeemingId.value = item.id;
  try {
    await redeemPoints({
      productId: item.id,
      clientRequestId: `pc-${item.id}-${Date.now()}`,
    });
    appMessage.success(t('pointsRedemption.success'));
    await load();
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('pointsRedemption.failed')));
  } finally {
    redeemingId.value = '';
  }
}

onMounted(() => {
  void load();
});
</script>
