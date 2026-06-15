<template>
  <PageContainer :title="t('attractions.title')" :description="t('attractions.desc')">
    <template #extra>
      <a-button :loading="loading" @click="loadList">{{ t('common.refresh') }}</a-button>
    </template>

    <DouxingAdminTable
      :columns="columns"
      :data-source="list"
      :loading="loading"
      :error="error"
      :empty-text="t('attractions.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <div>{{ record.name }}</div>
          <div v-if="record.description" class="sub">{{ record.description }}</div>
        </template>
        <template v-else-if="column.key === 'coord'">
          <a-tag v-if="hasCoords(record)" color="success">
            {{ formatCoord(record.latitude!) }}, {{ formatCoord(record.longitude!) }}
          </a-tag>
          <a-tag v-else color="warning">{{ t('attractions.missingCoord') }}</a-tag>
        </template>
        <template v-else-if="column.key === 'category'">
          {{ categoryLabel(record.category) }}
        </template>
        <template v-else-if="column.key === 'source'">
          {{ sourceLabel(record.source) }}
        </template>
        <template v-else-if="column.key === 'price'">
          {{ record.ticketPrice > 0 ? `¥${record.ticketPrice}` : '-' }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="success"
              :label="approvingId === record.id ? t('attractions.approving') : t('attractions.approve')"
              :title="t('attractions.approve')"
              @click="handleApprove(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Modal } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import type { AttractionInfo } from '@douxing/shared';
import { approveAttraction, fetchPendingAttractionsPage } from '@/api/attractions';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import { getAppErrorMessage } from '@/utils/error-message';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.attractionsPending');

const { t } = useI18n();
const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination(fetchPendingAttractionsPage);
const error = ref('');
const approvingId = ref<number | null>(null);

function categoryLabel(category: string) {
  const map: Record<string, string> = {
    attraction: t('attractions.typeAttraction'),
    restaurant: t('attractions.typeRestaurant'),
    hotel: t('attractions.typeHotel'),
  };
  return map[category] ?? category;
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    seed: t('attractions.sourceSeed'),
    llm: t('attractions.sourceLlm'),
    manual: t('attractions.sourceManual'),
    amap: t('attractions.sourceAmap'),
  };
  return map[source] ?? source;
}

function hasCoords(item: AttractionInfo) {
  return item.latitude != null && item.longitude != null;
}

function formatCoord(value: number) {
  return value.toFixed(4);
}

async function loadList() {
  reload();
}

async function handleApprove(item: AttractionInfo) {
  if (!hasCoords(item)) {
    Modal.confirm({
      title: t('attractions.approve'),
      content: t('attractions.approveConfirm', { name: item.name }),
      onOk: () => doApprove(item),
    });
    return;
  }
  await doApprove(item);
}

async function doApprove(item: AttractionInfo) {
  approvingId.value = item.id;
  error.value = '';
  try {
    await approveAttraction(item.id);
    await load();
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.approveFailed'));
  } finally {
    approvingId.value = null;
  }
}

const columns = computed<TableColumnsType<AttractionInfo>>(() => [
  { title: 'ID', dataIndex: 'id', width: 80 },
  { title: t('attractions.colName'), key: 'name', dataIndex: 'name', ellipsis: true },
  { title: t('attractions.colCity'), dataIndex: 'city', width: 100 },
  { title: t('attractions.colType'), key: 'category', width: 100 },
  { title: t('attractions.colCoord'), key: 'coord', width: 180 },
  { title: t('attractions.colSource'), key: 'source', width: 100 },
  { title: t('attractions.colPrice'), key: 'price', width: 100 },
  { title: t('attractions.colAction'), key: 'action', width: 120 },
]);

onMounted(load);
</script>

<style scoped>
.sub {
  color: #6b7280;
  font-size: 12px;
}
</style>
