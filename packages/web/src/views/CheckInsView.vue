<template>
  <PageContainer :title="t('checkins.title')">
    <template #extra>
      <router-link to="/checkins/map">
        <a-button type="link">{{ t('checkins.mapLink') }}</a-button>
      </router-link>
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
          <span v-else>-</span>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import type { CheckInInfo } from '@douxing/shared';
import { fetchCheckInsPage } from '@/api/checkins';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.checkins');

const { t } = useI18n();
const { items, loading, pagination, load, handleTableChange } = useServerTablePagination<CheckInInfo>(
  (page, pageSize) => fetchCheckInsPage({ page, pageSize, all: true }),
);

const columns = computed<TableColumnsType<CheckInInfo>>(() => [
  { title: t('checkins.colUser'), dataIndex: 'userId', width: 100 },
  { title: t('checkins.colRoute'), dataIndex: 'routeId', width: 100 },
  {
    title: t('checkins.colPlace'),
    dataIndex: ['location', 'placeName'],
    ellipsis: true,
    customRender: ({ record }) => record.location.placeName || '-',
  },
  {
    title: t('checkins.colCity'),
    width: 120,
    customRender: ({ record }) => record.city || record.cityCode,
  },
  { title: t('checkins.colPoints'), dataIndex: 'pointsEarned', width: 90 },
  { title: t('checkins.colPhotos'), key: 'photos', width: 160 },
  {
    title: t('checkins.colTime'),
    dataIndex: 'checkedAt',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 16).replace('T', ' '),
  },
]);

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
