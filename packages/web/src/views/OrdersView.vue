<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('orders.colOrderNo')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('orders.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('orders.colOrderType')">
          <a-select
            v-model:value="orderTypeFilter"
            :options="orderTypeOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('orders.allTypes')"
          />
        </a-form-item>
        <a-form-item :label="t('orders.colStatus')">
          <a-select
            v-model:value="statusFilter"
            :options="statusOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('orders.allStatuses')"
          />
        </a-form-item>
        <a-form-item :label="t('orders.colUser')">
          <a-input-number
            v-model:value="userIdFilter"
            :min="1"
            :placeholder="t('orders.colUser')"
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item :label="t('orders.colTime')">
          <a-range-picker
            v-model:value="dateRange"
            value-format="YYYY-MM-DD"
            style="width: 240px"
            :placeholder="[t('common.dateRangeStart'), t('common.dateRangeEnd')]"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="web.orders"
          />
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="reload">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <DouxingAdminTable
      :columns="columns"
      :data-source="items"
      :loading="loading"
      :empty-text="t('orders.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import type { OrderInfo } from '@douxing/shared';
import { getOrderStatusI18nKey, OrderStatus, OrderType } from '@douxing/shared';
import { fetchOrdersPage } from '@/api/orders';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

usePageTitle('web.orders');

const { t } = useI18n();
const keyword = ref('');
const orderTypeFilter = ref<string | undefined>();
const statusFilter = ref<number | undefined>();
const userIdFilter = ref<number | undefined>();
const dateRange = ref<[string, string] | undefined>();

const orderTypeOptions = computed(() => [
  { label: t('orderType.route'), value: OrderType.ROUTE },
  { label: t('orderType.membership'), value: OrderType.MEMBERSHIP },
]);

const statusOptions = computed(() => [
  { label: t('orderStatus.pending'), value: OrderStatus.PENDING },
  { label: t('orderStatus.paid'), value: OrderStatus.PAID },
  { label: t('orderStatus.completed'), value: OrderStatus.COMPLETED },
  { label: t('orderStatus.cancelled'), value: OrderStatus.CANCELLED },
]);

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<OrderInfo>((page, pageSize) =>
    fetchOrdersPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      orderType: orderTypeFilter.value,
      status: statusFilter.value,
      userId: userIdFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );

function orderStatusLabel(status: number) {
  return t(getOrderStatusI18nKey(status));
}

function orderTypeLabel(orderType: string) {
  const key = orderType === OrderType.MEMBERSHIP ? 'orderType.membership' : 'orderType.route';
  return t(key);
}

const columns = computed<TableColumnsType<OrderInfo>>(() => [
  { title: t('orders.colOrderNo'), dataIndex: 'orderNo', width: 180, ellipsis: true },
  { title: t('orders.colProduct'), dataIndex: 'productName', ellipsis: true },
  {
    title: t('orders.colOrderType'),
    dataIndex: 'orderType',
    width: 120,
    customRender: ({ text }) => orderTypeLabel(String(text)),
  },
  {
    title: t('orders.colAmount'),
    dataIndex: 'totalAmount',
    width: 120,
    customRender: ({ text }) => `¥${text}`,
  },
  {
    title: t('orders.colStatus'),
    dataIndex: 'status',
    width: 120,
    customRender: ({ record }) => orderStatusLabel(record.status),
  },
  { title: t('orders.colUser'), dataIndex: 'userId', width: 100 },
  {
    title: t('orders.colTime'),
    dataIndex: 'createdAt',
    width: 180,
  },
]);

function resetSearch() {
  keyword.value = '';
  orderTypeFilter.value = undefined;
  statusFilter.value = undefined;
  userIdFilter.value = undefined;
  dateRange.value = undefined;
  reload();
}

async function fetchExportRows() {
  return fetchAllPaginatedRows((page, pageSize) =>
    fetchOrdersPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
      orderType: orderTypeFilter.value,
      status: statusFilter.value,
      userId: userIdFilter.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
}

onMounted(load);
</script>
