<template>
  <SubPageShell
    :title="t('verificationPoints.title')"
    :description="t('verificationPoints.hint')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div class="mb-6 rounded-2xl bg-gradient-to-br from-teal-700 to-teal-950 px-6 py-5 text-white shadow-lg">
      <p class="text-sm text-white/80">{{ t('verificationPoints.balanceLabel') }}</p>
      <p class="mt-1 text-4xl font-bold">{{ balance }}</p>
      <button
        type="button"
        class="mt-4 rounded-full bg-white/15 px-4 py-2 text-sm text-teal-50 hover:bg-white/25"
        @click="goRedeem"
      >
        {{ t('verificationPoints.goRedeem') }}
      </button>
    </div>

    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <div v-else-if="events.length === 0" class="dx-card text-center text-dx-muted">
      <p class="font-medium">{{ t('verificationPoints.empty') }}</p>
      <p class="mt-1 text-sm">{{ t('verificationPoints.emptyDesc') }}</p>
    </div>
    <div v-else class="space-y-2">
      <div
        v-for="item in events"
        :key="item.id"
        class="flex items-center justify-between rounded-xl border border-dx-border bg-white px-4 py-3"
      >
        <div class="min-w-0">
          <p class="font-medium text-dx-text">{{ eventTypeLabel(item.eventType) }}</p>
          <p class="text-xs text-dx-muted">{{ item.createdAt }}</p>
        </div>
        <p
          class="text-lg font-bold"
          :class="item.points >= 0 ? 'text-teal-700' : 'text-rose-600'"
        >
          {{ formatPoints(item.points) }}
        </p>
      </div>
      <button
        v-if="hasMore"
        type="button"
        class="w-full rounded-xl border border-dx-border py-2 text-sm text-dx-muted hover:bg-gray-50"
        :disabled="loadingMore"
        @click="loadMore"
      >
        {{ loadingMore ? t('common.loading') : t('verificationPoints.loadMore') }}
      </button>
    </div>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { VerificationPointEventInfo } from '@douxing/shared';
import { VerificationPointEventType, VerificationPointSpendEventType } from '@douxing/shared';
import { fetchVerificationPoints } from '@/api/user';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const router = useRouter();

const loading = ref(true);
const loadingMore = ref(false);
const balance = ref(0);
const events = ref<VerificationPointEventInfo[]>([]);
const page = ref(1);
const total = ref(0);
const pageSize = 20;

const hasMore = computed(() => events.value.length < total.value);

/**
 * 将事件类型映射为可读文案。
 *
 * @param eventType - 账本事件类型
 * @returns 展示文案
 */
function eventTypeLabel(eventType: string) {
  const map: Record<string, string> = {
    [VerificationPointEventType.INSPIRATION_PUBLISH]: t('verificationPoints.eventInspiration'),
    [VerificationPointEventType.FOLLOW_COMPLETE]: t('verificationPoints.eventFollow'),
    [VerificationPointEventType.CORRECTION_ACCEPTED]: t('verificationPoints.eventCorrection'),
    [VerificationPointEventType.TRAVEL_READY_UPGRADE]: t('verificationPoints.eventTravelReady'),
    [VerificationPointEventType.CHECKIN_KEY_NODE]: t('verificationPoints.eventKeyNode'),
    [VerificationPointEventType.CHECKIN_FIRST_POI]: t('verificationPoints.eventFirstPoi'),
    [VerificationPointEventType.CHECKIN_QUALITY]: t('verificationPoints.eventQuality'),
    [VerificationPointSpendEventType.REDEEM_AI_PLAN]: t('verificationPoints.eventRedeemAiPlan'),
    [VerificationPointSpendEventType.REDEEM_PHOTO_QUOTA]: t('verificationPoints.eventRedeemPhoto'),
    [VerificationPointSpendEventType.REDEEM_MEMBER_TRIAL]: t('verificationPoints.eventRedeemMember'),
    [VerificationPointSpendEventType.REDEEM_POSTER_STICKER]: t('verificationPoints.eventRedeemSticker'),
  };
  return map[eventType] ?? eventType;
}

/**
 * 带符号展示积分变动。
 *
 * @param points - 变动值
 * @returns 文案
 */
function formatPoints(points: number) {
  return points > 0 ? `+${points}` : String(points);
}

/**
 * 跳转兑换页。
 */
function goRedeem() {
  router.push({ name: 'points-redemption' });
}

/**
 * 拉取账本页。
 *
 * @param reset - 是否重置
 */
async function load(reset = false) {
  if (reset) {
    page.value = 1;
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  try {
    const summary = await fetchVerificationPoints(page.value, pageSize);
    balance.value = summary.balance;
    total.value = summary.total;
    events.value = reset ? summary.events : [...events.value, ...summary.events];
  } catch (err) {
    console.error('[verification-points]', err);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

/**
 * 加载下一页。
 */
function loadMore() {
  if (!hasMore.value || loadingMore.value) return;
  page.value += 1;
  void load(false);
}

onMounted(() => {
  void load(true);
});
</script>
