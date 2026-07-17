<template>
  <SubPageShell
    :title="t('nav.profileEdit')"
    :back-to="{ name: 'profile' }"
    :back-label="t('pc.nav.profile')"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <template v-else>
      <div class="dx-card mb-6 text-center">
        <button type="button" class="group inline-flex flex-col items-center" @click="pickAvatar">
          <img
            v-if="form.avatar"
            :src="form.avatar"
            alt=""
            class="h-24 w-24 rounded-2xl object-cover ring-2 ring-dx-border group-hover:ring-dx-primary"
          />
          <div
            v-else
            class="flex h-24 w-24 items-center justify-center rounded-2xl bg-dx-primary-light text-3xl font-bold text-dx-primary"
          >
            {{ avatarText }}
          </div>
          <span class="mt-2 text-sm text-dx-primary">{{ t('profileEdit.avatarHint') }}</span>
        </button>
        <input ref="fileInputRef" type="file" accept="image/*" class="hidden" @change="onAvatarSelected" />
      </div>

      <div class="dx-card mb-4 space-y-4">
        <label class="block">
          <span class="mb-1 block text-sm font-medium">{{ t('profileEdit.nickname') }}</span>
          <input v-model="form.nickname" maxlength="64" class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm" />
        </label>
        <label class="block">
          <span class="mb-1 block text-sm font-medium">{{ t('profileEdit.email') }}</span>
          <input v-model="form.email" maxlength="128" class="w-full rounded-xl border border-dx-border px-3 py-2 text-sm" />
        </label>
      </div>

      <div class="dx-card mb-4">
        <p class="mb-3 text-sm font-medium">{{ interestTagsTitle }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in presets"
            :key="tag"
            type="button"
            class="rounded-full px-3 py-1 text-sm transition"
            :class="chipClass(form.interestTags.includes(tag))"
            @click="toggleTag(tag)"
          >
            {{ labelOf(tag) }}
          </button>
        </div>
      </div>

      <div class="dx-card mb-6 space-y-4">
        <div>
          <p class="text-sm font-medium">{{ t('personalization.profile.travelPersonaTitle') }}</p>
          <p class="mt-1 text-xs text-dx-muted">{{ t('personalization.profile.travelPersonaDesc') }}</p>
        </div>

        <div>
          <p class="mb-2 text-sm text-dx-muted">{{ t('personalization.profile.gender') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="g in genderPresets"
              :key="g"
              type="button"
              class="rounded-full px-3 py-1 text-sm transition"
              :class="chipClass(form.gender === g)"
              @click="form.gender = form.gender === g ? null : g"
            >
              {{ formatGenderLabel(g, currentLocale) }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm text-dx-muted">{{ t('personalization.profile.ageRange') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="a in ageRangePresets"
              :key="a"
              type="button"
              class="rounded-full px-3 py-1 text-sm transition"
              :class="chipClass(form.ageRange === a)"
              @click="form.ageRange = form.ageRange === a ? null : a"
            >
              {{ formatAgeRangeLabel(a, currentLocale) }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm text-dx-muted">{{ t('personalization.profile.travelRadius') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in travelRadiusPresets"
              :key="r"
              type="button"
              class="rounded-full px-3 py-1 text-sm transition"
              :class="chipClass(form.travelRadius === r)"
              @click="form.travelRadius = form.travelRadius === r ? null : r"
            >
              {{ formatTravelRadiusLabel(r, currentLocale) }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm text-dx-muted">{{ t('personalization.profile.preferredScenes') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="s in sceneTagPresets"
              :key="s"
              type="button"
              class="rounded-full px-3 py-1 text-sm transition"
              :class="chipClass(form.preferredScenes.includes(s))"
              @click="toggleScene(s)"
            >
              {{ formatSceneTagLabel(s, currentLocale) }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm text-dx-muted">{{ t('personalization.profile.companionStructure') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in companionStructurePresets"
              :key="c"
              type="button"
              class="rounded-full px-3 py-1 text-sm transition"
              :class="chipClass(form.companionStructure.includes(c))"
              @click="toggleCompanion(c)"
            >
              {{ formatCompanionStructureLabel(c, currentLocale) }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-2 text-sm text-dx-muted">{{ t('personalization.profile.budgetTier') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="b in budgetTierPresets"
              :key="b"
              type="button"
              class="rounded-full px-3 py-1 text-sm transition"
              :class="chipClass(form.budgetTier === b)"
              @click="form.budgetTier = form.budgetTier === b ? null : b"
            >
              {{ formatBudgetTierLabel(b, currentLocale) }}
            </button>
          </div>
        </div>

        <button type="button" class="dx-btn-secondary w-full" @click="goReOnboard">
          {{ t('personalization.profile.reOnboard') }}
        </button>
      </div>

      <button type="button" class="dx-btn-primary w-full" :disabled="saving" @click="handleSave">
        {{ saving ? t('common.loading') : t('common.save') }}
      </button>
    </template>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  formatInterestTagLabel,
  interestTagPresets,
  USER_INTEREST_MAX,
  genderPresets,
  ageRangePresets,
  travelRadiusPresets,
  companionStructurePresets,
  budgetTierPresets,
  sceneTagPresets,
  formatGenderLabel,
  formatAgeRangeLabel,
  formatTravelRadiusLabel,
  formatCompanionStructureLabel,
  formatBudgetTierLabel,
  formatSceneTagLabel,
} from '@douxing/shared';
import { fetchUserProfile, updateUserProfile, uploadUserAvatar } from '@/api/user';
import SubPageShell from '@/components/SubPageShell.vue';
import { appMessage } from '@/composables/useAppMessage';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const userStore = useUserStore();
const { t, currentLocale } = useLocale();

const loading = ref(true);
const saving = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const presets = interestTagPresets;

const form = ref({
  nickname: '',
  email: '',
  avatar: null as string | null,
  interestTags: [] as string[],
  gender: null as string | null,
  ageRange: null as string | null,
  travelRadius: null as string | null,
  preferredScenes: [] as string[],
  companionStructure: [] as string[],
  budgetTier: null as string | null,
});

const avatarText = computed(() => form.value.nickname.slice(0, 1) || '?');
const interestTagsTitle = computed(() =>
  t('profileEdit.interestTagsTitle', { max: USER_INTEREST_MAX }),
);

/**
 * Chip 选中态样式。
 *
 * @param active - 是否选中
 * @returns class 字符串
 */
function chipClass(active: boolean): string {
  return active
    ? 'bg-dx-primary text-white'
    : 'bg-gray-100 text-dx-muted hover:bg-gray-200';
}

/**
 * 兴趣标签展示文案。
 *
 * @param tag - 兴趣标签存储值
 * @returns 本地化文案
 */
function labelOf(tag: string) {
  return formatInterestTagLabel(tag, currentLocale.value);
}

/**
 * 切换兴趣标签。
 *
 * @param tag - 兴趣标签
 */
function toggleTag(tag: string) {
  const idx = form.value.interestTags.indexOf(tag);
  if (idx >= 0) {
    form.value.interestTags.splice(idx, 1);
    return;
  }
  if (form.value.interestTags.length >= USER_INTEREST_MAX) {
    appMessage.warning(t('profileEdit.maxTagsToast', { max: USER_INTEREST_MAX }));
    return;
  }
  form.value.interestTags.push(tag);
}

/**
 * 切换场景标签。
 *
 * @param slug - 场景 slug
 */
function toggleScene(slug: string) {
  const idx = form.value.preferredScenes.indexOf(slug);
  if (idx >= 0) form.value.preferredScenes.splice(idx, 1);
  else form.value.preferredScenes.push(slug);
}

/**
 * 切换同伴结构。
 *
 * @param slug - 同伴 slug
 */
function toggleCompanion(slug: string) {
  const idx = form.value.companionStructure.indexOf(slug);
  if (idx >= 0) form.value.companionStructure.splice(idx, 1);
  else form.value.companionStructure.push(slug);
}

/** 跳转重新引导 */
function goReOnboard() {
  router.push({ name: 'onboarding', query: { redirect: '/profile/edit' } });
}

function pickAvatar() {
  fileInputRef.value?.click();
}

async function onAvatarSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const user = await uploadUserAvatar(file);
    form.value.avatar = user.avatar;
    if (userStore.token) userStore.setAuth(userStore.token, user);
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('profileEdit.uploadFailed')));
  }
}

async function handleSave() {
  if (!form.value.nickname.trim()) {
    appMessage.warning(t('profileEdit.nicknameRequired'));
    return;
  }
  saving.value = true;
  try {
    const user = await updateUserProfile({
      nickname: form.value.nickname.trim(),
      email: form.value.email.trim() || null,
      interestTags: form.value.interestTags,
      preferredScenes: form.value.preferredScenes,
      gender: form.value.gender,
      ageRange: form.value.ageRange,
      travelRadius: form.value.travelRadius,
      companionStructure: form.value.companionStructure,
      budgetTier: form.value.budgetTier,
    });
    if (userStore.token) userStore.setAuth(userStore.token, user);
    appMessage.success(t('profileEdit.saveSuccess'));
    setTimeout(() => router.push({ name: 'profile' }), 600);
  } catch (err) {
    appMessage.error(getAppErrorMessage(err, t('profileEdit.saveFailed')));
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  try {
    const user = await fetchUserProfile();
    form.value = {
      nickname: user.nickname || user.username,
      email: user.email ?? '',
      avatar: user.avatar,
      interestTags: [...(user.interestTags ?? [])],
      gender: user.gender ?? null,
      ageRange: user.ageRange ?? null,
      travelRadius: user.travelRadius ?? null,
      preferredScenes: [...(user.preferredScenes ?? [])],
      companionStructure: [...(user.companionStructure ?? [])],
      budgetTier: user.budgetTier ?? null,
    };
  } catch {
    router.push({ name: 'login', query: { redirect: '/profile/edit' } });
  } finally {
    loading.value = false;
  }
});
</script>
