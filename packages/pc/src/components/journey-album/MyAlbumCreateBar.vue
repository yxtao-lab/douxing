<template>
  <div class="mb-4">
    <button type="button" class="dx-btn-primary" :disabled="creating" @click="openCreateModal">
      {{ creating ? t('common.loading') : t('myAlbum.create') }}
    </button>
  </div>

  <Teleport to="body">
    <div
      v-if="createModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6"
      @mousedown.self="closeCreateModal"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white shadow-xl" @mousedown.stop>
        <div class="border-b border-dx-border px-6 py-5">
          <h3 class="text-xl font-semibold text-dx-text">{{ t('myAlbum.createModalTitle') }}</h3>
          <p class="mt-1 text-sm text-dx-muted">{{ t('myAlbum.createHint') }}</p>
        </div>

        <div class="space-y-5 px-6 py-5">
          <div>
            <label class="mb-2 block text-sm font-medium text-dx-text">
              {{ t('myAlbum.pickRouteTitle') }}
            </label>
            <div v-if="routesLoading" class="text-sm text-dx-muted">{{ t('common.loading') }}</div>
            <div v-else-if="availableRoutes.length === 0" class="text-sm text-dx-muted">
              <p>{{ t('myAlbum.noRoutesForCreate') }}</p>
              <RouterLink :to="{ name: 'routes' }" class="mt-2 text-dx-primary hover:underline">
                {{ t('profile.actionRoutes') }}
              </RouterLink>
            </div>
            <select
              v-else
              v-model.number="selectedRouteId"
              class="w-full rounded-xl border border-dx-border px-3 py-2.5 text-sm outline-none focus:border-dx-primary"
            >
              <option :value="0" disabled>{{ t('myAlbum.selectRoutePlaceholder') }}</option>
              <option v-for="route in availableRoutes" :key="route.id" :value="route.id">
                {{ route.name }}（{{ t('pc.route.days', { count: route.days }) }}）
              </option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-dx-text">
              {{ t('myAlbum.albumTitle') }}
            </label>
            <input
              v-model.trim="albumTitle"
              type="text"
              maxlength="128"
              class="w-full rounded-xl border border-dx-border px-3 py-2.5 text-sm outline-none focus:border-dx-primary"
              :placeholder="t('myAlbum.albumTitlePlaceholder')"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-dx-border px-6 py-5">
          <button type="button" class="dx-btn-secondary" :disabled="creating" @click="closeCreateModal">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="dx-btn-primary"
            :disabled="!canSubmit || creating"
            @click="submitCreate"
          >
            {{ creating ? t('common.loading') : t('myAlbum.createConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TravelRouteInfo } from '@douxing/shared';
import { createJourneyAlbum } from '@/api/journey-album-create';
import { fetchRoutesPage } from '@/api/routes';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { getAppErrorMessage } from '@/utils/error-message';

const props = defineProps<{
  linkedRouteIds: number[];
}>();

const emit = defineEmits<{
  created: [albumId: number];
}>();

const { t } = useLocale();

const createModalOpen = ref(false);
const routesLoading = ref(false);
const routes = ref<TravelRouteInfo[]>([]);
const selectedRouteId = ref(0);
const albumTitle = ref('');
const creating = ref(false);

const linkedRouteIdSet = computed(() => new Set(props.linkedRouteIds));

const availableRoutes = computed(() =>
  routes.value.filter((route) => !linkedRouteIdSet.value.has(route.id)),
);

const canSubmit = computed(() => selectedRouteId.value > 0 && availableRoutes.value.length > 0);

async function openCreateModal() {
  createModalOpen.value = true;
  selectedRouteId.value = 0;
  albumTitle.value = '';
  routesLoading.value = true;
  try {
    const result = await fetchRoutesPage({ scope: 'mine', page: 1, pageSize: 100 });
    routes.value = result.items;
    if (availableRoutes.value.length === 1) {
      selectedRouteId.value = availableRoutes.value[0].id;
    }
  } catch {
    routes.value = [];
  } finally {
    routesLoading.value = false;
  }
}

function closeCreateModal() {
  if (creating.value) return;
  createModalOpen.value = false;
}

async function submitCreate() {
  if (!canSubmit.value) {
    appMessage.warning(t('myAlbum.selectRouteFirst'));
    return;
  }

  creating.value = true;
  try {
    const album = await createJourneyAlbum(
      selectedRouteId.value,
      albumTitle.value || undefined,
    );
    appMessage.success(t('myAlbum.createSuccess'));
    emit('created', album.id);
    closeCreateModal();
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('myAlbum.createFailed')));
  } finally {
    creating.value = false;
  }
}
</script>
