<template>
  <view class="page" :class="themeClass">
    <view class="page-body">
      <DouxingEmptyState v-if="loading" loading embedded compact />

      <template v-else-if="detail">
        <view class="info-card">
          <text class="title">{{ detail.name }}</text>
          <text class="meta">{{ groupTypeLabel(detail.groupType) }}</text>
          <text v-if="detail.headcount" class="meta">
            {{ t('marketplaceUi.fieldHeadcount') }}：{{ detail.headcount }}
          </text>
          <button class="btn-primary block" size="mini" @click="goPublishAsGroup">
            {{ t('marketplaceUi.publishAsGroup') }}
          </button>
        </view>

        <view v-if="isOwner" class="section-card">
          <text class="section-title">{{ t('marketplaceUi.inviteSubmit') }}</text>
          <view class="invite-row">
            <input
              v-model="inviteUserId"
              class="input"
              type="number"
              :placeholder="t('marketplaceUi.inviteUserIdPlaceholder')"
            />
            <button class="btn-primary" size="mini" :loading="inviting" @click="handleInvite">
              {{ t('marketplaceUi.inviteSubmit') }}
            </button>
          </view>
        </view>

        <view class="section-card">
          <text class="section-title">{{ t('marketplaceUi.membersTitle') }}</text>
          <view v-for="member in detail.members" :key="member.id" class="member-row">
            <view class="member-info">
              <text class="member-name">{{ member.nickname || member.username || `#${member.userId}` }}</text>
              <text class="member-role">{{ memberRoleLabel(member.memberRole) }}</text>
            </view>
            <button
              v-if="isOwner && member.memberRole !== 'owner'"
              class="btn-outline"
              size="mini"
              @click="handleRemove(member.userId)"
            >
              {{ t('marketplaceUi.removeMember') }}
            </button>
          </view>
        </view>

        <view class="section-card">
          <text class="section-title">{{ t('marketplaceUi.groupDemandsTitle') }}</text>
          <DouxingEmptyState
            v-if="demands.length === 0"
            :title="t('marketplaceUi.emptyGroupDemands')"
            embedded
            compact
          />
          <view v-else class="list">
            <view v-for="item in demands" :key="item.id" class="demand-card" @click="goDemand(item.id)">
              <text class="card-title">{{ item.title }}</text>
              <text class="meta">{{ demandStatusLabel(item.status) }}</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { onLoad, onShow } from '@dcloudio/uni-app';
import { GroupMemberRole, type DemandGroupDetail, type ServiceDemandSummary } from '@douxing/shared';
import { fetchMyMarketplaceDemands } from '@/api/marketplace';
import {
  fetchMarketplaceGroupDetail,
  inviteMarketplaceGroupMember,
  removeMarketplaceGroupMember,
} from '@/api/marketplace-groups';
import { useTf } from '@/i18n/useTf';
import { useTheme } from '@/i18n/useTheme';
import { usePageTitle } from '@/i18n/usePageTitle';
import { getAppErrorMessage, getStoredUser } from '@/utils/request';
import { useSuppressPetFloatingOnPage } from '@/composables/usePetCompanion';

usePageTitle('marketplace.groupDetailTitle');
useSuppressPetFloatingOnPage();
const { t } = useTf();
const { themeClass } = useTheme();

const groupId = ref(0);
const loading = ref(false);
const inviting = ref(false);
const detail = ref<DemandGroupDetail | null>(null);
const demands = ref<ServiceDemandSummary[]>([]);
const inviteUserId = ref('');

const isOwner = computed(() => {
  const user = getStoredUser() as { id?: number } | null;
  if (!user?.id || !detail.value) return false;
  return detail.value.members.some(
    (m) => m.userId === user.id && m.memberRole === GroupMemberRole.OWNER,
  );
});

/**
 * 解析团体类型展示名。
 *
 * @param type - 团体类型
 * @returns 本地化标签
 */
function groupTypeLabel(type: string) {
  const key = `marketplace.groupType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

/**
 * 解析成员角色展示名。
 *
 * @param role - 成员角色
 * @returns 本地化标签
 */
function memberRoleLabel(role: string) {
  const key = `marketplace.memberRole.${role}`;
  const label = t(key);
  return label !== key ? label : role;
}

/**
 * 解析需求状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function demandStatusLabel(status: string) {
  const key = `marketplace.demandStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 加载团体详情与本团需求列表。
 */
async function load() {
  if (!groupId.value) return;
  if (!getStoredUser()) {
    uni.navigateTo({ url: '/pages/login/login' });
    return;
  }
  loading.value = true;
  try {
    detail.value = await fetchMarketplaceGroupDetail(groupId.value);
    const all = await fetchMyMarketplaceDemands();
    demands.value = all.filter((d) => d.publisherGroupId === groupId.value);
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    loading.value = false;
  }
}

/**
 * 邀请协作者。
 */
async function handleInvite() {
  const uid = Number(inviteUserId.value);
  if (!Number.isInteger(uid) || uid <= 0) {
    uni.showToast({ title: t('marketplaceUi.inviteUserIdPlaceholder'), icon: 'none' });
    return;
  }
  inviting.value = true;
  try {
    await inviteMarketplaceGroupMember(groupId.value, { userId: uid });
    inviteUserId.value = '';
    uni.showToast({ title: t('marketplaceUi.inviteSuccess'), icon: 'success' });
    await load();
  } catch (e) {
    uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
  } finally {
    inviting.value = false;
  }
}

/**
 * 移除协作者。
 *
 * @param userId - 被移除用户 ID
 */
function handleRemove(userId: number) {
  uni.showModal({
    title: t('marketplaceUi.removeMember'),
    content: t('marketplaceUi.removeMemberConfirm'),
    success: async (res) => {
      if (!res.confirm) return;
      try {
        await removeMarketplaceGroupMember(groupId.value, userId);
        await load();
      } catch (e) {
        uni.showToast({ title: getAppErrorMessage(e), icon: 'none' });
      }
    },
  });
}

function goPublishAsGroup() {
  uni.navigateTo({ url: `/pages/marketplace/create?groupId=${groupId.value}` });
}

/**
 * 跳转需求详情。
 *
 * @param id - 需求 ID
 */
function goDemand(id: number) {
  uni.navigateTo({ url: `/pages/marketplace/detail?id=${id}` });
}

onLoad((query) => {
  groupId.value = Number(query?.id || 0);
});

onShow(load);
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--dx-page-bg);
}
.page-body {
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.info-card,
.section-card {
  background: var(--dx-surface);
  border-radius: var(--dx-radius-md);
  padding: 28rpx;
  box-shadow: var(--dx-shadow-sm);
}
.title {
  display: block;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--dx-text);
  margin-bottom: 12rpx;
}
.meta {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--dx-text-secondary);
}
.section-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
  margin-bottom: 20rpx;
}
.invite-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
}
.input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  box-sizing: border-box;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-sm);
  font-size: 26rpx;
  color: var(--dx-text);
}
.member-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--dx-border);
}
.member-row:last-child {
  border-bottom: none;
}
.member-name {
  display: block;
  font-size: 28rpx;
  color: var(--dx-text);
}
.member-role {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--dx-text-muted);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.demand-card {
  padding: 20rpx;
  background: var(--dx-bg);
  border-radius: var(--dx-radius-sm);
}
.card-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--dx-text);
}
.btn-primary {
  margin: 0;
  background: var(--dx-primary);
  color: var(--dx-text-inverse);
}
.btn-primary.block {
  margin-top: 24rpx;
  width: 100%;
}
.btn-primary::after {
  border: none;
}
.btn-outline {
  margin: 0;
  background: var(--dx-surface);
  color: var(--dx-text);
  border: 2rpx solid var(--dx-border);
}
.btn-outline::after {
  border: none;
}
</style>
