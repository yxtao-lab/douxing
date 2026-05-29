<template>
  <view class="page" :class="themeClass">
    <view class="edit-hero">
      <view class="hero-bg" />
      <view class="avatar-section" @click="chooseAvatar">
        <image v-if="form.avatar" class="avatar-img" :src="form.avatar" mode="aspectFill" />
        <view v-else class="avatar-placeholder">{{ avatarText }}</view>
        <text class="avatar-hint">{{ t('profileEdit.avatarHint') }}</text>
      </view>
    </view>

    <view class="page-body">
      <view class="form-card">
        <view class="field">
          <text class="label">{{ t('profileEdit.nickname') }}</text>
          <input
            v-model="form.nickname"
            class="input"
            maxlength="64"
            :placeholder="t('profileEdit.nicknamePlaceholder')"
          />
        </view>
        <view class="field">
          <text class="label">{{ t('profileEdit.email') }}</text>
          <input
            v-model="form.email"
            class="input"
            type="text"
            maxlength="128"
            :placeholder="t('profileEdit.emailOptional')"
          />
        </view>
      </view>

      <view class="form-card">
        <text class="label block">{{ interestTagsTitle }}</text>
        <view class="tags">
          <text
            v-for="tag in presets"
            :key="tag"
            class="tag"
            :class="{ active: form.interestTags.includes(tag) }"
            @click="toggleTag(tag)"
          >
            {{ labelOf(tag) }}
          </text>
        </view>
      </view>

      <button class="save-btn" :loading="saving" @click="handleSave">{{ t('common.save') }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { UserInfo } from '@douxing/shared';
import { USER_INTEREST_MAX } from '@douxing/shared';
import { fetchCurrentUser, updateUserProfile, uploadUserAvatar } from '@/api/user';
import { getStoredUser } from '@/utils/request';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { interestTagPresets } from '@/i18n/interest-tags';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

const { t, tf } = useTf();
const { themeClass } = useTheme();
const { labelOf } = useInterestTagLabel();
usePageTitle('nav.profileEdit');

const presets = interestTagPresets;
const maxTags = USER_INTEREST_MAX;

const saving = ref(false);
const uploading = ref(false);

const form = ref({
  nickname: '',
  email: '',
  avatar: '' as string | null,
  interestTags: [] as string[],
});

const avatarText = computed(() => form.value.nickname.slice(0, 1) || '?');

const interestTagsTitle = computed(() => tf('profileEdit.interestTagsTitle', { max: maxTags }));

function applyUser(user: UserInfo) {
  form.value = {
    nickname: user.nickname || user.username,
    email: user.email ?? '',
    avatar: user.avatar,
    interestTags: [...(user.interestTags ?? [])],
  };
}

function toggleTag(tag: string) {
  const idx = form.value.interestTags.indexOf(tag);
  if (idx >= 0) {
    form.value.interestTags.splice(idx, 1);
    return;
  }
  if (form.value.interestTags.length >= maxTags) {
    uni.showToast({ title: tf('profileEdit.maxTagsToast', { max: maxTags }), icon: 'none' });
    return;
  }
  form.value.interestTags.push(tag);
}

async function chooseAvatar() {
  if (uploading.value) return;
  try {
    const choose = await new Promise<UniApp.ChooseImageSuccessCallbackResult>(
      (resolve, reject) => {
        uni.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: resolve,
          fail: reject,
        });
      },
    );
    const filePath = choose.tempFilePaths[0];
    if (!filePath) return;

    uploading.value = true;
    uni.showLoading({ title: t('profileEdit.uploading') });
    const user = await uploadUserAvatar(filePath);
    form.value.avatar = user.avatar;
    uni.showToast({ title: t('profileEdit.avatarUpdated'), icon: 'success' });
  } catch (err) {
    const message = err instanceof Error ? err.message : t('profileEdit.uploadFailed');
    uni.showToast({ title: message, icon: 'none' });
  } finally {
    uploading.value = false;
    uni.hideLoading();
  }
}

async function handleSave() {
  const nickname = form.value.nickname.trim();
  if (!nickname) {
    uni.showToast({ title: t('profileEdit.nicknameRequired'), icon: 'none' });
    return;
  }

  const emailRaw = form.value.email.trim();
  const payload: {
    nickname: string;
    interestTags: string[];
    email?: string | null;
  } = {
    nickname,
    interestTags: form.value.interestTags,
  };

  if (emailRaw) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      uni.showToast({ title: t('profileEdit.invalidEmail'), icon: 'none' });
      return;
    }
    payload.email = emailRaw;
  } else {
    payload.email = null;
  }

  saving.value = true;
  try {
    await updateUserProfile(payload);
    uni.showToast({ title: t('profileEdit.saveSuccess'), icon: 'success' });
    setTimeout(() => uni.navigateBack(), 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : t('profileEdit.saveFailed');
    uni.showToast({ title: message, icon: 'none' });
  } finally {
    saving.value = false;
  }
}

onLoad(async () => {
  const cached = getStoredUser();
  if (cached) applyUser(cached);
  try {
    const fresh = await fetchCurrentUser();
    applyUser(fresh);
  } catch {
    if (!cached) {
      uni.showToast({ title: t('profileEdit.loginRequired'), icon: 'none' });
      setTimeout(() => uni.redirectTo({ url: '/pages/login/login' }), 500);
    }
  }
});
</script>

<style scoped>
.page {
  --page-gutter: 32rpx;
  min-height: 100vh;
  background: var(--dx-bg);
  padding-bottom: 48rpx;
  box-sizing: border-box;
}
.edit-hero {
  position: relative;
  margin-bottom: 24rpx;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--dx-gradient-hero);
  border-radius: 0 0 var(--dx-radius-xl) var(--dx-radius-xl);
  box-shadow: var(--dx-shadow-hero);
}
.avatar-section {
  position: relative;
  z-index: 1;
  padding: 48rpx var(--page-gutter) 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}
.avatar-img,
.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.45);
}
.avatar-placeholder {
  background: rgba(255, 255, 255, 0.22);
  color: var(--dx-text-inverse);
  font-size: 56rpx;
  font-weight: 600;
  line-height: 160rpx;
  text-align: center;
}
.avatar-hint {
  color: rgba(255, 255, 255, 0.88);
  font-size: 24rpx;
}
.page-body {
  padding: 0 var(--page-gutter);
}
.form-card {
  margin-bottom: 24rpx;
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  box-shadow: var(--dx-shadow-sm);
}
.field {
  margin-bottom: 24rpx;
}
.field:last-child {
  margin-bottom: 0;
}
.label {
  font-size: 26rpx;
  color: var(--dx-text-secondary);
  display: block;
  margin-bottom: 12rpx;
}
.label.block {
  margin-bottom: 20rpx;
}
.input {
  background: var(--dx-bg);
  border: 2rpx solid var(--dx-border);
  border-radius: var(--dx-radius-sm);
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: var(--dx-text);
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.tag {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: var(--dx-bg);
  color: var(--dx-text);
  font-size: 26rpx;
}
.tag.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  border: 2rpx solid var(--dx-primary-light);
}
.save-btn {
  margin-top: 8rpx;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
  border-radius: var(--dx-radius-lg);
  border: none;
  box-shadow: var(--dx-shadow-md);
  font-size: 30rpx;
  font-weight: 600;
}
.save-btn::after {
  border: none;
}
</style>
