<template>
  <div class="mx-auto max-w-2xl px-4 py-6 lg:px-8">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-dx-text">{{ t('routes.inspirationPageTitle') }}</h1>
      <p class="mt-1 text-sm text-dx-muted">{{ t('routes.inspirationPageDesc') }}</p>
    </header>

    <form class="dx-card space-y-5" @submit.prevent="handleSubmit">
      <div>
        <label class="mb-1.5 block text-sm text-dx-muted">{{ t('routes.editNameLabel') }}</label>
        <input
          v-model="form.name"
          type="text"
          maxlength="128"
          class="w-full rounded-xl border border-dx-border bg-white px-3 py-2.5 text-sm text-dx-text outline-none ring-dx-primary focus:ring-2"
          :placeholder="t('routes.nameInputPlaceholder')"
        />
      </div>
      <div>
        <label class="mb-1.5 block text-sm text-dx-muted">{{ t('routes.editDescLabel') }}</label>
        <textarea
          v-model="form.description"
          maxlength="2000"
          rows="4"
          class="w-full rounded-xl border border-dx-border bg-white px-3 py-2.5 text-sm text-dx-text outline-none ring-dx-primary focus:ring-2"
          :placeholder="t('routes.descInputPlaceholder')"
        />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1.5 block text-sm text-dx-muted">{{ t('routes.inspirationDaysLabel') }}</label>
          <input
            v-model="form.days"
            type="number"
            min="1"
            max="30"
            class="w-full rounded-xl border border-dx-border bg-white px-3 py-2.5 text-sm text-dx-text outline-none ring-dx-primary focus:ring-2"
          />
        </div>
        <div>
          <label class="mb-1.5 block text-sm text-dx-muted">{{ t('routes.inspirationBudgetLabel') }}</label>
          <input
            v-model="form.budgetRange"
            type="text"
            maxlength="64"
            class="w-full rounded-xl border border-dx-border bg-white px-3 py-2.5 text-sm text-dx-text outline-none ring-dx-primary focus:ring-2"
            :placeholder="t('routes.inspirationBudgetPlaceholder')"
          />
        </div>
      </div>

      <div class="flex flex-wrap gap-3 pt-2">
        <button type="submit" class="dx-btn-primary" :disabled="submitting">
          {{ submitting ? t('common.loading') : t('routes.inspirationSubmit') }}
        </button>
        <button type="button" class="dx-btn-secondary" :disabled="submitting" @click="goBack">
          {{ t('routes.editCancel') }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { createInspirationRoute } from '@/api/routes';
import { useLocale } from '@/i18n/useLocale';
import { appMessage } from '@/composables/useAppMessage';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const { t } = useLocale();

const submitting = ref(false);
const form = reactive({
  name: '',
  description: '',
  days: '3',
  budgetRange: '',
});

/**
 * 返回路线列表。
 */
function goBack() {
  void router.push({ name: 'routes' });
}

/**
 * 提交灵感稿并跳转详情。
 */
async function handleSubmit() {
  const name = form.name.trim();
  if (!name) {
    appMessage.error(t('routes.nameRequired'));
    return;
  }
  const days = Number(form.days);
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    appMessage.error(t('routes.inspirationFailed'));
    return;
  }

  submitting.value = true;
  try {
    const route = await createInspirationRoute({
      name,
      description: form.description.trim() || null,
      budgetRange: form.budgetRange.trim() || null,
      days,
      sourceKind: 'ugc_original',
    });
    appMessage.success(t('routes.inspirationSuccess'));
    await router.replace({ name: 'route-detail', params: { id: String(route.id) } });
  } catch (e) {
    appMessage.error(getAppErrorMessage(e, t('routes.inspirationFailed')));
  } finally {
    submitting.value = false;
  }
}
</script>
