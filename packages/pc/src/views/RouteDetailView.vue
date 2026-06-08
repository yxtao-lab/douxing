<template>
  <div class="mx-auto max-w-7xl px-4 py-6 lg:px-8">
    <div v-if="loading && !route" class="dx-card text-center text-dx-muted">
      {{ t('common.loading') }}
    </div>

    <div v-else-if="loadError" class="dx-card text-center">
      <p class="mb-4 text-red-600">{{ loadError }}</p>
      <button type="button" class="dx-btn-secondary" @click="loadDetail">{{ t('common.refresh') }}</button>
    </div>

    <template v-else-if="route">
      <div
        v-if="toastMessage"
        class="mb-4 flex items-center justify-between gap-2 rounded-xl border border-dx-border bg-white px-4 py-2 text-sm shadow-sm"
      >
        <span>{{ toastMessage }}</span>
        <button type="button" class="text-dx-muted hover:text-dx-text" @click="dismissToast">×</button>
      </div>

      <!-- Hero -->
      <section class="mb-6 overflow-hidden rounded-2xl bg-dx-hero text-white shadow-hero">
        <div class="p-6 lg:p-8">
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="mb-2 flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-bold lg:text-3xl">{{ route.name }}</h1>
                <span
                  v-if="isOwner"
                  class="rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium"
                >
                  {{ routeStatusLabel }}
                </span>
              </div>
              <p class="text-sm text-white/85">{{ heroMeta }}</p>
            </div>
            <button
              v-if="canEditRouteInfo"
              type="button"
              class="shrink-0 rounded-xl bg-white/15 px-4 py-2 text-sm backdrop-blur transition hover:bg-white/25"
              @click="openEditModal"
            >
              {{ t('routes.editRouteInfo') }}
            </button>
          </div>

          <p v-if="route.description" class="mb-4 max-w-3xl leading-relaxed text-white/90">
            {{ route.description }}
          </p>

          <div class="flex flex-wrap gap-4 text-sm text-white/85">
            <span>{{ t('routes.statViews', { count: route.viewCount ?? 0 }) }}</span>
            <span>{{ t('routes.statLikes', { count: route.likeCount ?? 0 }) }}</span>
            <span>{{ t('routes.statCollects', { count: route.collectCount ?? 0 }) }}</span>
            <span>{{ t('routes.statComments', { count: route.commentCount ?? 0 }) }}</span>
          </div>

          <p v-if="route.creatorNickname && !isOwner" class="mt-3 text-sm text-white/75">
            {{ t('routes.authorShare', { name: route.creatorNickname }) }}
          </p>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <div class="space-y-6 lg:col-span-2">
          <!-- 公开分享开关 -->
          <div v-if="showShareSetting" class="dx-card">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="font-medium text-dx-text">{{ t('routes.shareTitle') }}</p>
                <p class="mt-1 text-sm text-dx-muted">{{ t('routes.shareHint') }}</p>
              </div>
              <label class="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  class="peer sr-only"
                  :checked="route.isPublic"
                  :disabled="sharing"
                  @change="handleShareToggle(($event.target as HTMLInputElement).checked)"
                />
                <span
                  class="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-dx-primary peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5"
                />
              </label>
            </div>
          </div>

          <!-- 行程：地图 + 流程图 -->
          <div v-if="isUnlocked && days.length > 0" class="dx-card space-y-6">
            <RouteDayTabs
              v-if="days.length > 1"
              v-model:active-day-index="activeDayIndex"
              :days="days"
            />

            <RouteMapByDay
              v-model:active-day-index="activeDayIndex"
              :route-id="numericRouteId"
              :days="days"
              :route-detail="(route.routeDetail as Record<string, unknown>) ?? null"
              :route-name="route.name"
              :auto-play="true"
              :show-day-tabs="false"
            />

            <hr class="border-dx-border" />

            <RouteDayFlowChart
              v-model:active-day-index="activeDayIndex"
              :days="days"
              :show-day-tabs="false"
            />
          </div>

          <!-- 未解锁 -->
          <div v-if="!isUnlocked" class="dx-card text-center">
            <p class="mb-2 text-dx-muted">{{ t('routes.lockTip') }}</p>
            <p class="mb-4 text-2xl font-semibold text-dx-text">¥{{ unlockPrice }}</p>
            <button type="button" class="dx-btn-primary" :disabled="paying" @click="handleUnlock">
              {{ paying ? t('common.loading') : t('routes.unlockPayMock') }}
            </button>
          </div>

          <!-- 重新生成 -->
          <div v-if="canRegenerate" class="dx-card">
            <h3 class="mb-1 font-semibold text-dx-text">{{ t('routes.regenerateTitle') }}</h3>
            <p class="mb-3 text-sm text-dx-muted">{{ regenerateHint }}</p>
            <textarea
              v-model="regeneratePrompt"
              rows="3"
              class="mb-3 w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.regeneratePlaceholder')"
              maxlength="200"
            />
            <button type="button" class="dx-btn-secondary" @click="handleRegenerate">
              {{ t('routes.regenerateBtn') }}
            </button>
          </div>

          <!-- 评论 -->
          <div v-if="showComments" class="dx-card">
            <h3 class="mb-4 font-semibold text-dx-text">{{ t('routes.commentsTitle') }}</h3>
            <p v-if="comments.length === 0" class="mb-4 text-sm text-dx-muted">
              {{ t('routes.commentsEmpty') }}
            </p>
            <div v-for="c in comments" :key="c.id" class="mb-4 border-b border-dx-border pb-4 last:border-0">
              <p class="text-sm font-medium text-dx-text">{{ c.userNickname }}</p>
              <p class="mt-1 text-sm text-dx-muted">{{ c.content }}</p>
            </div>
            <textarea
              v-model="commentText"
              rows="3"
              class="mb-3 w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.commentPlaceholder')"
              maxlength="500"
            />
            <button
              type="button"
              class="dx-btn-primary"
              :disabled="postingComment"
              @click="handlePostComment"
            >
              {{ t('routes.postComment') }}
            </button>
          </div>
        </div>

        <!-- 侧边栏操作 -->
        <aside class="space-y-4">
          <div class="dx-card space-y-3">
            <template v-if="showInteraction">
              <button
                type="button"
                class="dx-btn-secondary w-full"
                :class="{ '!border-dx-primary !text-dx-primary': route.isLiked }"
                @click="handleLike"
              >
                {{ route.isLiked ? t('routes.liked') : t('routes.like') }}
              </button>
              <button
                type="button"
                class="dx-btn-secondary w-full"
                :class="{ '!border-dx-primary !text-dx-primary': route.isFavorited }"
                @click="handleFavorite"
              >
                {{ route.isFavorited ? t('routes.favorited') : t('routes.favorite') }}
              </button>
            </template>
            <button
              v-if="canGeneratePoster"
              type="button"
              class="dx-btn-secondary w-full"
              @click="posterSheetVisible = true"
            >
              {{ t('routes.generatePoster') }}
            </button>
            <button
              v-if="route.status !== publishedStatus"
              type="button"
              class="dx-btn-primary w-full"
              @click="handlePublish"
            >
              {{ t('routes.publishRoute') }}
            </button>
            <RouterLink :to="{ name: 'routes' }" class="block text-center text-sm text-dx-primary hover:underline">
              {{ t('pc.routes.backToList') }}
            </RouterLink>
          </div>
        </aside>
      </div>
    </template>

    <!-- 编辑草稿弹窗 -->
    <Teleport to="body">
      <div
        v-if="editModalVisible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        @click.self="closeEditModal"
      >
        <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" @click.stop>
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-dx-text">{{ t('routes.editDraftTitle') }}</h2>
            <button type="button" class="text-dx-muted hover:text-dx-text" @click="closeEditModal">×</button>
          </div>
          <p class="mb-4 text-sm text-dx-muted">{{ t('routes.editDraftHint') }}</p>
          <label class="mb-4 block">
            <span class="mb-1 block text-sm font-medium text-dx-text">{{ t('routes.editNameLabel') }}</span>
            <input
              v-model="editName"
              type="text"
              maxlength="128"
              class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.nameInputPlaceholder')"
            />
          </label>
          <label class="mb-6 block">
            <span class="mb-1 block text-sm font-medium text-dx-text">{{ t('routes.editDescLabel') }}</span>
            <textarea
              v-model="editDesc"
              rows="4"
              maxlength="500"
              class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('routes.descInputPlaceholder')"
            />
          </label>
          <div class="flex justify-end gap-3">
            <button type="button" class="dx-btn-secondary" @click="closeEditModal">
              {{ t('routes.editCancel') }}
            </button>
            <button type="button" class="dx-btn-primary" :disabled="savingDraft" @click="handleSaveDraft">
              {{ t('routes.saveDraft') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <RoutePosterSheet
      :visible="posterSheetVisible"
      :route="route"
      @close="posterSheetVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import RouteDayFlowChart from '@/components/route/RouteDayFlowChart.vue';
import RouteDayTabs from '@/components/route/RouteDayTabs.vue';
import RouteMapByDay from '@/components/route/RouteMapByDay.vue';
import RoutePosterSheet from '@/components/route/RoutePosterSheet.vue';
import { useRouteDetail } from '@/composables/useRouteDetail';
import { useLocale } from '@/i18n/useLocale';
import { useInterestTagLabels } from '@/composables/useInterestTagLabels';
import { RouteStatus } from '@douxing/shared';

const vueRoute = useRoute();
const { t } = useLocale();
const { joinLabels } = useInterestTagLabels();

const posterSheetVisible = ref(false);
const publishedStatusForPoster = RouteStatus.PUBLISHED;

const numericRouteId = computed(() => Number(vueRoute.params.id));

const {
  route,
  loading,
  loadError,
  toastMessage,
  activeDayIndex,
  paying,
  sharing,
  savingDraft,
  postingComment,
  editModalVisible,
  editName,
  editDesc,
  regeneratePrompt,
  comments,
  commentText,
  publishedStatus,
  isOwner,
  canEditRouteInfo,
  showShareSetting,
  showInteraction,
  showComments,
  canRegenerate,
  isUnlocked,
  days,
  unlockPrice,
  routeStatusLabel,
  regenerateHint,
  loadPaymentConfig,
  loadDetail,
  dismissToast,
  openEditModal,
  closeEditModal,
  handleShareToggle,
  handlePostComment,
  handleLike,
  handleFavorite,
  handleSaveDraft,
  handleRegenerate,
  handleUnlock,
  handlePublish,
} = useRouteDetail(() => numericRouteId.value);

const canGeneratePoster = computed(
  () =>
    isUnlocked.value &&
    days.value.length > 0 &&
    route.value?.status === publishedStatusForPoster,
);

const heroMeta = computed(() => {
  if (!route.value) return '';
  return t('routes.metaHero', {
    days: route.value.days,
    budget: route.value.budgetRange ?? t('routes.budgetTbd'),
    tags: joinLabels.value(route.value.interestTags),
  });
});

watch(numericRouteId, () => {
  void loadDetail();
});

onMounted(async () => {
  await loadPaymentConfig();
  await loadDetail();
});
</script>
