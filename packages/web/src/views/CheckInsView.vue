<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('checkins.colPlace')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('checkins.searchKeyword')"
            allow-clear
            style="width: 220px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('checkins.colUser')">
          <a-input-number
            v-model:value="userIdFilter"
            :min="1"
            :placeholder="t('checkins.searchUserId')"
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item :label="t('checkins.colRoute')">
          <a-input-number
            v-model:value="routeIdFilter"
            :min="1"
            :placeholder="t('checkins.searchRouteId')"
            style="width: 120px"
          />
        </a-form-item>
        <a-form-item :label="t('checkins.colCity')">
          <a-input
            v-model:value="cityCodeFilter"
            :placeholder="t('checkins.searchCityCode')"
            allow-clear
            style="width: 160px"
            @press-enter="reload"
          />
        </a-form-item>
        <a-form-item :label="t('checkins.colTime')">
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
          <router-link to="/checkins/map">
            <a-button>{{ t('checkins.mapLink') }}</a-button>
          </router-link>
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="web.checkins"
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
      :empty-text="t('checkins.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'photos'">
          <a-image-preview-group v-if="record.photos.length">
            <a-space>
              <a-image
                v-for="(url, index) in record.photos.slice(0, 3)"
                :key="index"
                :src="url"
                :width="40"
                :height="40"
                class="photo-thumb"
              />
              <span v-if="record.photos.length > 3" class="photo-more">
                +{{ record.photos.length - 3 }}
              </span>
            </a-space>
          </a-image-preview-group>
          <span v-else>{{ ADMIN_TABLE_EMPTY_PLACEHOLDER }}</span>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { CheckInInfo } from '@douxing/shared';
import { fetchCheckInsPage } from '@/api/checkins';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import {
  ADMIN_TABLE_EMPTY_PLACEHOLDER,
  formatAdminTableCell,
} from '@/utils/adminTableColumns';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

usePageTitle('web.checkins');

const { t } = useI18n();
const keyword = ref('');
const userIdFilter = ref<number | undefined>();
const routeIdFilter = ref<number | undefined>();
const cityCodeFilter = ref('');
const dateRange = ref<[string, string] | undefined>();

const { items, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination<CheckInInfo>((page, pageSize) =>
    fetchCheckInsPage({
      page,
      pageSize,
      all: true,
      keyword: keyword.value.trim() || undefined,
      userId: userIdFilter.value,
      routeId: routeIdFilter.value,
      cityCode: cityCodeFilter.value.trim() || undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );

const columns = computed<AdminExportColumn<CheckInInfo>[]>(() => [
  { title: t('checkins.colUser'), dataIndex: 'userId', width: 100 },
  { title: t('checkins.colRoute'), dataIndex: 'routeId', width: 100 },
  {
    title: t('checkins.colPlace'),
    dataIndex: ['location', 'placeName'],
    ellipsis: true,
    customRender: ({ record }) => record.location?.placeName,
  },
  {
    title: t('checkins.colCity'),
    width: 120,
    customRender: ({ record }) => record.city || record.cityCode,
  },
  { title: t('checkins.colPoints'), dataIndex: 'pointsEarned', width: 90 },
  {
    title: t('checkins.colPhotos'),
    key: 'photos',
    width: 160,
    exportValue: (record) => formatAdminTableCell(record.photos),
  },
  {
    title: t('checkins.colTime'),
    dataIndex: 'checkedAt',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 16).replace('T', ' '),
  },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchCheckInsPage({
      page,
      pageSize,
      all: true,
      keyword: keyword.value.trim() || undefined,
      userId: userIdFilter.value,
      routeId: routeIdFilter.value,
      cityCode: cityCodeFilter.value.trim() || undefined,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

function resetSearch() {
  keyword.value = '';
  userIdFilter.value = undefined;
  routeIdFilter.value = undefined;
  cityCodeFilter.value = '';
  dateRange.value = undefined;
  reload();
}

onMounted(load);
</script>

<style scoped>
.photo-thumb {
  object-fit: cover;
  border-radius: 4px;
}

.photo-more {
  color: #6b7280;
  font-size: 12px;
}
</style>
