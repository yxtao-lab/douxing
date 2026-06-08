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

      <div class="dx-card mb-6">
        <p class="mb-3 text-sm font-medium">{{ interestTagsTitle }}</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in presets"
            :key="tag"
            type="button"
            class="rounded-full px-3 py-1 text-sm transition"
            :class="
              form.interestTags.includes(tag)
                ? 'bg-dx-primary text-white'
                : 'bg-gray-100 text-dx-muted hover:bg-gray-200'
            "
            @click="toggleTag(tag)"
          >
            {{ labelOf(tag) }}
          </button>
        </div>
      </div>

      <p v-if="toastMessage" class="mb-4 text-sm text-red-600">{{ toastMessage }}</p>
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
} from '@douxing/shared';
import { fetchUserProfile, updateUserProfile, uploadUserAvatar } from '@/api/user';
import SubPageShell from '@/components/SubPageShell.vue';
import { useLocale } from '@/i18n/useLocale';
import { useUserStore } from '@/stores/user';
import { getAppErrorMessage } from '@/utils/error-message';

const router = useRouter();
const userStore = useUserStore();
const { t, currentLocale } = useLocale();

const loading = ref(true);
const saving = ref(false);
const toastMessage = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);
const presets = interestTagPresets;

const form = ref({
  nickname: '',
  email: '',
  avatar: null as string | null,
  interestTags: [] as string[],
});

const avatarText = computed(() => form.value.nickname.slice(0, 1) || '?');
const interestTagsTitle = computed(() =>
  t('profileEdit.interestTagsTitle', { max: USER_INTEREST_MAX }),
);

function labelOf(tag: string) {
  return formatInterestTagLabel(tag, currentLocale.value);
}

function toggleTag(tag: string) {
  const idx = form.value.interestTags.indexOf(tag);
  if (idx >= 0) {
    form.value.interestTags.splice(idx, 1);
    return;
  }
  if (form.value.interestTags.length >= USER_INTEREST_MAX) {
    toastMessage.value = t('profileEdit.maxTagsToast', { max: USER_INTEREST_MAX });
    return;
  }
  form.value.interestTags.push(tag);
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
    toastMessage.value = getAppErrorMessage(err, t('profileEdit.uploadFailed'));
  }
}

async function handleSave() {
  if (!form.value.nickname.trim()) {
    toastMessage.value = t('profileEdit.nicknameRequired');
    return;
  }
  saving.value = true;
  toastMessage.value = '';
  try {
    const user = await updateUserProfile({
      nickname: form.value.nickname.trim(),
      email: form.value.email.trim() || null,
      interestTags: form.value.interestTags,
    });
    if (userStore.token) userStore.setAuth(userStore.token, user);
    toastMessage.value = t('profileEdit.saveSuccess');
    setTimeout(() => router.push({ name: 'profile' }), 600);
  } catch (err) {
    toastMessage.value = getAppErrorMessage(err, t('profileEdit.saveFailed'));
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
    };
  } catch {
    router.push({ name: 'login', query: { redirect: '/profile/edit' } });
  } finally {
    loading.value = false;
  }
});
</script>
