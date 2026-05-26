<template>
  <view class="page">
    <view class="avatar-section" @click="chooseAvatar">
      <image v-if="form.avatar" class="avatar-img" :src="form.avatar" mode="aspectFill" />
      <view v-else class="avatar-placeholder">{{ avatarText }}</view>
      <text class="avatar-hint">{{ t('profileEdit.avatarHint') }}</text>
    </view>

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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import type { UserInfo } from '@douxing/shared';
import { USER_INTEREST_MAX } from '@douxing/shared';
import { fetchCurrentUser, updateUserProfile, uploadUserAvatar } from '@/api/user';
import { getStoredUser } from '@/utils/request';
import { usePageTitle } from '@/i18n/usePageTitle';
import { useTf } from '@/i18n/useTf';
import { interestTagPresets } from '@/i18n/interest-tags';
import { useInterestTagLabel } from '@/i18n/useInterestTagLabel';

const { t, tf } = useTf();
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
  min-height: 100vh;
  background: #f5f7fa;
  padding-bottom: 48rpx;
}
.avatar-section {
  background: #fff;
  padding: 48rpx;
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
}
.avatar-placeholder {
  background: #1677ff;
  color: #fff;
  font-size: 56rpx;
  line-height: 160rpx;
  text-align: center;
}
.avatar-hint {
  color: #6b7280;
  font-size: 24rpx;
}
.form-card {
  margin: 24rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}
.field {
  margin-bottom: 24rpx;
}
.field:last-child {
  margin-bottom: 0;
}
.label {
  font-size: 26rpx;
  color: #6b7280;
  display: block;
  margin-bottom: 12rpx;
}
.label.block {
  margin-bottom: 20rpx;
}
.input {
  background: #f9fafb;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.tag {
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #374151;
  font-size: 26rpx;
}
.tag.active {
  background: #e6f4ff;
  color: #1677ff;
  border: 1rpx solid #91caff;
}
.save-btn {
  margin: 32rpx 24rpx 0;
  background: #1677ff;
  color: #fff;
  border-radius: 12rpx;
}
</style>
