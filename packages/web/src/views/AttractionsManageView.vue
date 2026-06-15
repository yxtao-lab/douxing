<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="reload" @reset="resetSearch">
        <a-form-item :label="t('attractions.colName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('attractions.searchPlaceholder')"
            allow-clear
            style="width: 280px"
            @press-enter="reload"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
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
      :data-source="list"
      :loading="loading"
      :error="error"
      :empty-text="t('attractions.manageEmpty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'cover'">
          <a-image
            v-if="record.coverImageUrl"
            :src="record.coverImageUrl"
            :width="64"
            :height="64"
            class="cover-thumb"
          />
          <span v-else class="muted">{{ t('attractions.noCover') }}</span>
        </template>
        <template v-else-if="column.key === 'name'">
          <div>{{ record.name }}</div>
          <div v-if="record.description" class="sub">{{ record.description }}</div>
        </template>
        <template v-else-if="column.key === 'imageSource'">
          {{ imageSourceLabel(record.imageSource) }}
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <a-upload
              :show-upload-list="false"
              accept="image/*"
              :before-upload="makeUploadHandler(record)"
            >
              <TableActionButton
                variant="info"
                :icon="UploadOutlined"
                :label="
                  uploadingId === record.id
                    ? t('attractions.uploadingCover')
                    : t('attractions.uploadCover')
                "
              />
            </a-upload>
            <TableActionButton
              v-if="record.imageSource !== 'manual'"
              variant="primary"
              :icon="ReloadOutlined"
              :label="
                refreshingId === record.id
                  ? t('attractions.refreshingCover')
                  : t('attractions.refreshCover')
              "
              @click="handleRefreshCover(record)"
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
import type { UploadProps } from 'ant-design-vue';
import type { TableColumnsType } from 'ant-design-vue';
import type { AttractionInfo } from '@douxing/shared';
import {
  fetchAdminAttractionCatalogPage,
  uploadAttractionCover,
  refreshAttractionCoverFromAmap,
} from '@/api/attractions';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import { getAppErrorMessage } from '@/utils/error-message';
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.attractionsManage');

const { t } = useI18n();
const keyword = ref('');
const { items: list, loading, pagination, load, reload, handleTableChange } =
  useServerTablePagination((page, pageSize) =>
    fetchAdminAttractionCatalogPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
    }),
  );
const error = ref('');
const uploadingId = ref<number | null>(null);
const refreshingId = ref<number | null>(null);

function imageSourceLabel(source?: string | null) {
  if (!source) return t('attractions.imageSourceNone');
  const map: Record<string, string> = {
    manual: t('attractions.imageSourceManual'),
    amap: t('attractions.imageSourceAmap'),
    wikimedia: t('attractions.imageSourceWikimedia'),
    ugc: t('attractions.imageSourceUgc'),
    generated: t('attractions.imageSourceGenerated'),
  };
  return map[source] ?? source;
}

function resetSearch() {
  keyword.value = '';
  reload();
}

async function handleRefreshCover(item: AttractionInfo) {
  refreshingId.value = item.id;
  error.value = '';
  try {
    const updated = await refreshAttractionCoverFromAmap(item.id);
    list.value = list.value.map((row) => (row.id === item.id ? updated : row));
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.refreshCoverFailed'));
  } finally {
    refreshingId.value = null;
  }
}

function makeUploadHandler(item: AttractionInfo): UploadProps['beforeUpload'] {
  return (file) => {
    void doUpload(item, file as File);
    return false;
  };
}

async function doUpload(item: AttractionInfo, file: File) {
  uploadingId.value = item.id;
  error.value = '';
  try {
    const updated = await uploadAttractionCover(item.id, file);
    list.value = list.value.map((row) => (row.id === item.id ? updated : row));
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.uploadCoverFailed'));
  } finally {
    uploadingId.value = null;
  }
}

const columns = computed<TableColumnsType<AttractionInfo>>(() => [
  { title: t('attractions.colCover'), key: 'cover', width: 96 },
  { title: t('attractions.colName'), key: 'name', dataIndex: 'name', ellipsis: true },
  { title: t('attractions.colCity'), dataIndex: 'city', width: 100 },
  { title: t('attractions.colImageSource'), key: 'imageSource', width: 120 },
  { title: t('attractions.colAction'), key: 'action', width: 140 },
]);

onMounted(load);
</script>

<style scoped>
.cover-thumb {
  object-fit: cover;
  border-radius: 8px;
}

.sub {
  color: #6b7280;
  font-size: 12px;
}

.muted {
  color: #9ca3af;
  font-size: 12px;
}
</style>
