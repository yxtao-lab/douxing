<template>
  <PageContainer admin>
    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :rows="filteredItems"
            name-key="partner.scheduleTitle"
          />
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="load">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <a-row :gutter="[16, 16]">
      <a-col :xs="24" :lg="10">
        <a-card :title="t('partner.scheduleCalendar')" size="small">
          <a-calendar v-model:value="calendarValue" :fullscreen="false">
            <template #dateCellRender="{ current }">
              <ul v-if="countOnDay(current) > 0" class="schedule-dots">
                <li class="schedule-dot">{{ countOnDay(current) }}</li>
              </ul>
            </template>
          </a-calendar>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="14">
        <DouxingAdminTable
          :columns="columns"
          :data-source="filteredItems"
          :loading="loading"
          :empty-text="t('partner.scheduleEmpty')"
          row-key="id"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'title'">
              {{ record.demandTitle || record.productTitle || record.orderNo }}
            </template>
            <template v-else-if="column.key === 'trip'">
              {{ formatTripDates(record.demandStartDate, record.demandEndDate) }}
            </template>
            <template v-else-if="column.key === 'guide'">
              {{
                record.assignedGuideNickname
                  || record.assignedGuideUsername
                  || t('partner.guideUnassigned')
              }}
            </template>
            <template v-else-if="column.key === 'status'">
              {{ orderStatusLabel(record.status) }}
            </template>
            <template v-else-if="column.key === 'action'">
              <TableActionBar :show-edit="false" :show-delete="false">
                <TableActionButton
                  variant="info"
                  :label="t('partner.viewDetail')"
                  @click="$router.push({ name: 'partner-order-detail', params: { id: record.id } })"
                />
              </TableActionBar>
            </template>
          </template>
        </DouxingAdminTable>
      </a-col>
    </a-row>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import dayjs, { type Dayjs } from 'dayjs';
import type { ServiceOrderDetail } from '@douxing/shared';
import { fetchSellerMarketplaceOrders } from '@/api/marketplace-partner';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

usePageTitle('partner.scheduleTitle');
const { t } = useLocale();

const loading = ref(false);
const items = ref<ServiceOrderDetail[]>([]);
const calendarValue = ref<Dayjs>(dayjs());

const columns = computed<AdminExportColumn<ServiceOrderDetail>[]>(() => [
  {
    title: t('partner.colDemand'),
    key: 'title',
    width: 200,
    exportValue: (row) =>
      formatAdminTableCell(row.demandTitle || row.productTitle || row.orderNo),
  },
  {
    title: t('partner.colTripDates'),
    key: 'trip',
    width: 200,
    exportValue: (row) => formatTripDates(row.demandStartDate, row.demandEndDate),
  },
  {
    title: t('partner.colGuide'),
    key: 'guide',
    width: 140,
    exportValue: (row) =>
      formatAdminTableCell(
        row.assignedGuideNickname || row.assignedGuideUsername || t('partner.guideUnassigned'),
      ),
  },
  {
    title: t('partner.colOrderStatus'),
    key: 'status',
    width: 120,
    exportValue: (row) => orderStatusLabel(row.status),
  },
  { title: t('partner.colAction'), key: 'action', width: 100, resizable: false },
]);

/**
 * 当前日历月份内、且含行程日期的订单（按开始日升序）。
 */
const filteredItems = computed(() => {
  const month = calendarValue.value;
  return items.value
    .filter((item) => {
      if (!item.demandStartDate && !item.demandEndDate) return false;
      const start = item.demandStartDate ? dayjs(item.demandStartDate) : null;
      const end = item.demandEndDate ? dayjs(item.demandEndDate) : start;
      if (!start || !end) return false;
      const monthStart = month.startOf('month');
      const monthEnd = month.endOf('month');
      return !end.isBefore(monthStart, 'day') && !start.isAfter(monthEnd, 'day');
    })
    .sort((a, b) => String(a.demandStartDate ?? '').localeCompare(String(b.demandStartDate ?? '')));
});

/**
 * 解析订单状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function orderStatusLabel(status: string) {
  const key = `marketplace.orderStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 格式化行程起止日。
 *
 * @param start - 开始日
 * @param end - 结束日
 * @returns 展示文案
 */
function formatTripDates(start: string | null, end: string | null) {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return start;
  if (end) return end;
  return t('partner.tripDatesEmpty');
}

/**
 * 统计某日落入行程区间的订单数。
 *
 * @param current - 日历单元格日期
 * @returns 数量；无行程为 0
 */
function countOnDay(current: Dayjs) {
  return items.value.filter((item) => {
    if (!item.demandStartDate && !item.demandEndDate) return false;
    const start = dayjs(item.demandStartDate ?? item.demandEndDate);
    const end = dayjs(item.demandEndDate ?? item.demandStartDate);
    return (
      !current.isBefore(start, 'day') && !current.isAfter(end, 'day')
    );
  }).length;
}

/**
 * 加载卖方订单作为行程日历数据源。
 *
 * @returns 无返回值
 */
async function load() {
  loading.value = true;
  try {
    items.value = await fetchSellerMarketplaceOrders();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.schedule-dots {
  margin: 0;
  padding: 0;
  list-style: none;
}

.schedule-dot {
  display: inline-block;
  min-width: 18px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--color-primary, #1677ff);
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
</style>
