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
          <AdminTableExportButton
            :columns="columns"
            :fetch-rows="fetchExportRows"
            name-key="web.attractionsManage"
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
          <span v-else class="muted">{{ ADMIN_TABLE_EMPTY_PLACEHOLDER }}</span>
        </template>
        <template v-else-if="column.key === 'name'">
          <div>{{ formatAdminTableCell(record.name) }}</div>
          <div v-if="record.description" class="sub">{{ record.description }}</div>
        </template>
        <template v-else-if="column.key === 'imageSource'">
          {{ imageSourceLabel(record.imageSource) }}
        </template>
        <template v-else-if="column.key === 'sceneTags'">
          <a-space :size="4" wrap>
            <a-tag
              v-for="slug in record.sceneTags ?? []"
              :key="slug"
              color="blue"
            >
              {{ sceneTagLabel(slug) }}
            </a-tag>
            <span v-if="!record.sceneTags || record.sceneTags.length === 0" class="muted">
              {{ t('attractions.sceneTagsEmpty') }}
            </span>
          </a-space>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton
              variant="info"
              :icon="TagsOutlined"
              :label="t('attractions.sceneTagsEdit')"
              @click="openSceneTagsEditor(record)"
            />
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

    <a-modal
      :open="sceneTagsEditor.open"
      :title="
        sceneTagsEditor.item
          ? t('attractions.sceneTagsEditTitle', { name: sceneTagsEditor.item.name })
          : t('attractions.sceneTagsEdit')
      "
      :confirm-loading="sceneTagsEditor.saving"
      :ok-text="t('attractions.sceneTagsSave')"
      :cancel-text="t('common.cancel')"
      @ok="submitSceneTags"
      @cancel="closeSceneTagsEditor"
    >
      <p class="scene-tags-desc">{{ t('attractions.sceneTagsEditDesc') }}</p>
      <a-checkbox-group v-model:value="sceneTagsEditor.draft">
        <a-space direction="vertical" :size="8">
          <a-checkbox
            v-for="opt in sceneTagOptions"
            :key="opt.slug"
            :value="opt.slug"
          >
            {{ opt.label }}
          </a-checkbox>
        </a-space>
      </a-checkbox-group>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { UploadProps } from 'ant-design-vue';
import type { AttractionInfo } from '@douxing/shared';
import {
  formatSceneTagLabel,
  isSceneTagSlug,
  sceneTagPresets,
  type SceneTagSlug,
} from '@douxing/shared';
import {
  fetchAdminAttractionCatalogPage,
  uploadAttractionCover,
  refreshAttractionCoverFromAmap,
  updateAttractionSceneTags,
} from '@/api/attractions';
import { useServerTablePagination } from '@/composables/useServerTablePagination';
import { getAppErrorMessage } from '@/utils/error-message';
import { ReloadOutlined, UploadOutlined, TagsOutlined } from '@ant-design/icons-vue';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import {
  ADMIN_TABLE_EMPTY_PLACEHOLDER,
  formatAdminTableCell,
} from '@/utils/adminTableColumns';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { fetchAllPaginatedRows } from '@/utils/fetchAllPaginatedRows';

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

const sceneTagsEditor = ref<{
  open: boolean;
  saving: boolean;
  item: AttractionInfo | null;
  draft: string[];
}>({
  open: false,
  saving: false,
  item: null,
  draft: [],
});

const sceneTagOptions = computed(() =>
  sceneTagPresets.map((slug) => ({
    slug,
    label: formatSceneTagLabel(slug, 'zh-CN'),
  })),
);

/**
 * 根据场景标签 slug 渲染本地化文案；非法 slug 原样返回。
 *
 * @param slug - 场景标签 slug
 * @returns 当前 locale 下的展示文案
 */
function sceneTagLabel(slug: string): string {
  if (!isSceneTagSlug(slug)) return slug;
  return formatSceneTagLabel(slug as SceneTagSlug, 'zh-CN');
}

/**
 * 打开场景标签编辑弹窗，将当前景点的 sceneTags 复制到 draft。
 *
 * @param item - 选中的景点行
 */
function openSceneTagsEditor(item: AttractionInfo) {
  sceneTagsEditor.value = {
    open: true,
    saving: false,
    item,
    draft: [...(item.sceneTags ?? [])],
  };
}

function closeSceneTagsEditor() {
  sceneTagsEditor.value.open = false;
}

/**
 * 提交场景标签修改，成功后更新列表对应行。
 */
async function submitSceneTags() {
  const item = sceneTagsEditor.value.item;
  if (!item) return;
  sceneTagsEditor.value.saving = true;
  try {
    const updated = await updateAttractionSceneTags(
      item.id,
      sceneTagsEditor.value.draft,
    );
    list.value = list.value.map((row) => (row.id === item.id ? updated : row));
    sceneTagsEditor.value.open = false;
  } catch (e) {
    error.value = getAppErrorMessage(e, t('attractions.sceneTagsSaveFailed'));
  } finally {
    sceneTagsEditor.value.saving = false;
  }
}

function imageSourceLabel(source?: string | null) {
  if (!source) return ADMIN_TABLE_EMPTY_PLACEHOLDER;
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

const columns = computed<AdminExportColumn<AttractionInfo>[]>(() => [
  {
    title: t('attractions.colCover'),
    key: 'cover',
    width: 96,
    exportValue: (record) => formatAdminTableCell(record.coverImageUrl),
  },
  {
    title: t('attractions.colName'),
    key: 'name',
    dataIndex: 'name',
    ellipsis: true,
    exportValue: (record) =>
      record.description ? `${record.name}\n${record.description}` : record.name,
  },
  { title: t('attractions.colCity'), dataIndex: 'city', width: 100 },
  {
    title: t('attractions.colImageSource'),
    key: 'imageSource',
    width: 120,
    exportValue: (record) => imageSourceLabel(record.imageSource),
  },
  {
    title: t('attractions.colSceneTags'),
    key: 'sceneTags',
    width: 200,
    exportValue: (record) =>
      (record.sceneTags ?? [])
        .map((slug) => sceneTagLabel(slug))
        .join(', '),
  },
  { title: t('attractions.colAction'), key: 'action', width: 180 },
]);

async function fetchExportRows(): Promise<Record<string, unknown>[]> {
  const rows = await fetchAllPaginatedRows((page, pageSize) =>
    fetchAdminAttractionCatalogPage({
      page,
      pageSize,
      keyword: keyword.value.trim() || undefined,
    }),
  );
  return rows as unknown as Record<string, unknown>[];
}

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

.scene-tags-desc {
  color: #6b7280;
  font-size: 13px;
  margin-bottom: 16px;
}
</style>
