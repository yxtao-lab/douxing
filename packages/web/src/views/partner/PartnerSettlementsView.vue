<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('partner.colOrg')">
          <a-select
            v-model:value="selectedOrgId"
            :placeholder="t('partner.selectOrg')"
            style="width: 240px"
            allow-clear
            :options="orgOptions"
          />
        </a-form-item>
        <a-form-item :label="t('partner.colSettlementStatus')">
          <a-select
            v-model:value="statusFilter"
            :placeholder="t('common.statusAll')"
            style="width: 160px"
            allow-clear
            :options="statusOptions"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :rows="items"
            name-key="partner.settlementsTitle"
          />
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="load">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <a-alert
      v-if="!loadingContext && financeOrgs.length === 0"
      type="info"
      show-icon
      :message="t('partner.settlementsNoOrg')"
      class="partner-settlements-alert"
    >
      <template #action>
        <a-button size="small" @click="$router.push({ name: 'partner-onboard' })">
          {{ t('partner.goOnboard') }}
        </a-button>
      </template>
    </a-alert>

    <DouxingAdminTable
      v-else
      :columns="columns"
      :data-source="items"
      :loading="loading || loadingContext"
      :empty-text="t('partner.settlementsEmpty')"
      row-key="id"
      :pagination="false"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'orderNo'">
          <router-link :to="{ name: 'partner-order-detail', params: { id: record.orderId } }">
            {{ record.orderNo }}
          </router-link>
        </template>
        <template v-else-if="column.key === 'status'">
          {{ settlementStatusLabel(record.status) }}
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import {
  OrgRole,
  SettlementStatus,
  type OrgSettlementSummary,
} from '@douxing/shared';
import { fetchPartnerSettlements } from '@/api/marketplace-partner';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePartnerContext } from '@/composables/usePartnerContext';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('partner.settlementsTitle');
const { t } = useLocale();
const { context, loading: loadingContext, reload: reloadContext } = usePartnerContext();

const loading = ref(false);
const items = ref<OrgSettlementSummary[]>([]);
const selectedOrgId = ref<number | undefined>();
const statusFilter = ref<string | undefined>();

/** 仅 owner/admin 可查看财务的商户 */
const financeOrgs = computed(() => {
  const memberships = context.value?.memberships ?? [];
  return memberships.filter(
    (m) => m.orgRole === OrgRole.OWNER || m.orgRole === OrgRole.ADMIN,
  );
});

const orgOptions = computed(() =>
  financeOrgs.value.map((m) => ({
    value: m.orgId,
    label: m.org.name,
  })),
);

const statusOptions = computed(() => [
  { value: SettlementStatus.PENDING, label: t('marketplace.settlementStatus.pending') },
  { value: SettlementStatus.SETTLED, label: t('marketplace.settlementStatus.settled') },
  { value: SettlementStatus.VOID, label: t('marketplace.settlementStatus.void') },
]);

const columns = computed<AdminExportColumn[]>(() => [
  {
    title: t('partner.colOrderNo'),
    key: 'orderNo',
    width: 180,
    exportValue: (row) => formatAdminTableCell(row.orderNo),
  },
  { title: t('partner.colGrossAmount'), dataIndex: 'grossAmount', width: 120 },
  { title: t('partner.colPlatformFee'), dataIndex: 'platformFee', width: 120 },
  { title: t('partner.colNetAmount'), dataIndex: 'netAmount', width: 120 },
  {
    title: t('partner.colSettlementStatus'),
    key: 'status',
    width: 120,
    exportValue: (row) => settlementStatusLabel(row.status),
  },
  { title: t('partner.colCreatedAt'), dataIndex: 'createdAt', width: 180 },
  { title: t('partner.colSettledAt'), dataIndex: 'settledAt', width: 180 },
]);

/**
 * 解析结算状态展示名。
 *
 * @param status - 结算状态值
 * @returns 本地化标签；无对应键时回退原始值
 */
function settlementStatusLabel(status: string) {
  const key = `marketplace.settlementStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 重置筛选条件并重新加载。
 *
 * @returns 无返回值
 */
function resetSearch() {
  selectedOrgId.value = financeOrgs.value[0]?.orgId;
  statusFilter.value = undefined;
  void load();
}

/**
 * 加载当前商户的结算台账列表。
 *
 * @returns 无返回值；结果写入 `items`
 */
async function load() {
  const orgId = selectedOrgId.value;
  if (orgId == null) {
    items.value = [];
    return;
  }
  loading.value = true;
  try {
    items.value = await fetchPartnerSettlements({
      orgId,
      status: statusFilter.value,
    });
  } finally {
    loading.value = false;
  }
}

watch(financeOrgs, (orgs) => {
  if (selectedOrgId.value == null && orgs[0]) {
    selectedOrgId.value = orgs[0].orgId;
  }
});

onMounted(async () => {
  await reloadContext();
  if (selectedOrgId.value == null && financeOrgs.value[0]) {
    selectedOrgId.value = financeOrgs.value[0].orgId;
  }
  await load();
});
</script>

<style scoped>
.partner-settlements-alert {
  margin-bottom: 16px;
}
</style>
