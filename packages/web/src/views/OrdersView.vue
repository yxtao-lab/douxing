<template>
  <PageContainer :title="t('orders.title')" :description="t('orders.desc')">
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
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import type { OrderInfo } from '@douxing/shared';
import { getOrderStatusI18nKey, OrderType } from '@douxing/shared';
import { fetchOrdersPage } from '@/api/orders';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.orders');

const { t } = useI18n();
const { items, loading, pagination, load, handleTableChange } = useServerTablePagination<OrderInfo>(
  fetchOrdersPage,
);

function orderStatusLabel(status: number) {
  return t(getOrderStatusI18nKey(status));
}

function orderTypeLabel(orderType: string) {
  const key = orderType === OrderType.MEMBERSHIP ? 'orderType.membership' : 'orderType.route';
  return t(key);
}

const columns = computed<TableColumnsType<OrderInfo>>(() => [
  { title: t('orders.colOrderNo'), dataIndex: 'orderNo', ellipsis: true },
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
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 16).replace('T', ' '),
  },
]);

onMounted(load);
</script>
