<template>
  <SubPageShell
    :title="detail?.name || t('marketplace.groupDetailTitle')"
    :back-to="{ name: 'marketplace-groups' }"
    :back-label="t('marketplace.groupsTitle')"
  >
    <div v-if="loading" class="dx-card text-center text-dx-muted">{{ t('common.loading') }}</div>
    <template v-else-if="detail">
      <div class="dx-card mb-4 space-y-2">
        <p class="text-sm text-dx-muted">{{ groupTypeLabel(detail.groupType) }}</p>
        <p v-if="detail.headcount" class="text-sm text-dx-muted">
          {{ t('marketplaceUi.fieldHeadcount') }}：{{ detail.headcount }}
        </p>
        <RouterLink
          :to="{ name: 'marketplace-create', query: { groupId: detail.id } }"
          class="dx-btn-primary inline-flex text-sm"
        >
          {{ t('marketplaceUi.publishAsGroup') }}
        </RouterLink>
      </div>

      <div v-if="isOwner" class="dx-card mb-4 space-y-3">
        <h3 class="font-semibold text-dx-text">{{ t('marketplaceUi.inviteSubmit') }}</h3>
        <div class="flex gap-2">
          <input
            v-model="inviteUserId"
            class="dx-input flex-1"
            type="number"
            :placeholder="t('marketplaceUi.inviteUserIdPlaceholder')"
          />
          <button type="button" class="dx-btn-primary text-sm" :disabled="inviting" @click="handleInvite">
            {{ t('marketplaceUi.inviteSubmit') }}
          </button>
        </div>
      </div>

      <div class="dx-card mb-4 space-y-3">
        <h3 class="font-semibold text-dx-text">{{ t('marketplaceUi.membersTitle') }}</h3>
        <div
          v-for="member in detail.members"
          :key="member.id"
          class="flex items-center justify-between border-b border-dx-border py-2 last:border-0"
        >
          <div>
            <p class="text-dx-text">{{ member.nickname || member.username || `#${member.userId}` }}</p>
            <p class="text-xs text-dx-muted">{{ memberRoleLabel(member.memberRole) }}</p>
          </div>
          <button
            v-if="isOwner && member.memberRole !== 'owner'"
            type="button"
            class="dx-btn-outline text-sm"
            @click="handleRemove(member.userId)"
          >
            {{ t('marketplaceUi.removeMember') }}
          </button>
        </div>
      </div>

      <div class="dx-card space-y-3">
        <h3 class="font-semibold text-dx-text">{{ t('marketplaceUi.groupDemandsTitle') }}</h3>
        <p v-if="demands.length === 0" class="text-sm text-dx-muted">{{ t('marketplaceUi.emptyGroupDemands') }}</p>
        <RouterLink
          v-for="item in demands"
          :key="item.id"
          :to="{ name: 'marketplace-detail', params: { id: item.id } }"
          class="block rounded-lg bg-dx-bg p-3 hover:shadow-sm"
        >
          <p class="font-medium text-dx-text">{{ item.title }}</p>
          <p class="text-sm text-dx-primary">{{ demandStatusLabel(item.status) }}</p>
        </RouterLink>
      </div>
    </template>
  </SubPageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { GroupMemberRole, type DemandGroupDetail, type ServiceDemandSummary } from '@douxing/shared';
import { fetchMyMarketplaceDemands } from '@/api/marketplace';
import {
  fetchMarketplaceGroupDetail,
  inviteMarketplaceGroupMember,
  removeMarketplaceGroupMember,
} from '@/api/marketplace-groups';
import SubPageShell from '@/components/SubPageShell.vue';
import { useI18n } from 'vue-i18n';
import { useUserStore } from '@/stores/user';

const { t } = useI18n();
const route = useRoute();
const userStore = useUserStore();
const loading = ref(false);
const inviting = ref(false);
const detail = ref<DemandGroupDetail | null>(null);
const demands = ref<ServiceDemandSummary[]>([]);
const inviteUserId = ref('');

const groupId = computed(() => Number(route.params.id));

const isOwner = computed(() => {
  if (!userStore.user?.id || !detail.value) return false;
  return detail.value.members.some(
    (m) => m.userId === userStore.user!.id && m.memberRole === GroupMemberRole.OWNER,
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
 * 加载团体详情与本团需求。
 */
async function load() {
  if (!Number.isInteger(groupId.value) || groupId.value <= 0) return;
  loading.value = true;
  try {
    detail.value = await fetchMarketplaceGroupDetail(groupId.value);
    const all = await fetchMyMarketplaceDemands();
    demands.value = all.filter((d) => d.publisherGroupId === groupId.value);
  } finally {
    loading.value = false;
  }
}

/**
 * 邀请协作者。
 */
async function handleInvite() {
  const uid = Number(inviteUserId.value);
  if (!Number.isInteger(uid) || uid <= 0) return;
  inviting.value = true;
  try {
    await inviteMarketplaceGroupMember(groupId.value, { userId: uid });
    inviteUserId.value = '';
    await load();
  } finally {
    inviting.value = false;
  }
}

/**
 * 移除协作者。
 *
 * @param userId - 被移除用户 ID
 */
async function handleRemove(userId: number) {
  if (!window.confirm(t('marketplaceUi.removeMemberConfirm'))) return;
  await removeMarketplaceGroupMember(groupId.value, userId);
  await load();
}

onMounted(load);
watch(groupId, load);
</script>
