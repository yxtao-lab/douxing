<template>
  <PageContainer admin>
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
      :error="error ?? undefined"
      :empty-text="t('workflowTemplates.empty')"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'id'">
          <code>{{ record.id }}</code>
        </template>
        <template v-else-if="column.key === 'name'">
          {{ locale === 'en-US' ? record.nameEn : record.nameZh }}
        </template>
        <template v-else-if="column.key === 'topK'">
          {{ record.nodeConfig?.topK ?? '-' }}
        </template>
        <template v-else-if="column.key === 'variants'">
          {{ record.nodeConfig?.variantCount ?? '-' }}
        </template>
        <template v-else-if="column.key === 'enabled'">
          <a-tag :color="record.enabled ? 'success' : 'default'">
            {{ record.enabled ? t('workflowTemplates.enabledYes') : t('workflowTemplates.enabledNo') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'ab'">
          {{
            record.abSplitPercent > 0 && record.abVariantBId
              ? `${record.abSplitPercent}% → ${record.abVariantBId}`
              : t('workflowTemplates.abOff')
          }}
        </template>
        <template v-else-if="column.key === 'graphStatus'">
          <a-tag v-if="record.graphPublishStatus === 'published'" color="success">
            {{ t('workflowTemplates.graphPublished') }}
          </a-tag>
          <a-tag v-else-if="record.graphDef" color="processing">
            {{ t('workflowTemplates.graphDraft') }}
          </a-tag>
          <span v-else>{{ t('workflowTemplates.graphNone') }}</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-edit="false" :show-delete="false">
            <TableActionButton variant="edit" :label="t('workflowTemplates.edit')" @click="openEdit(record)" />
            <TableActionButton
              variant="primary"
              :label="t('workflowTemplates.openEditor')"
              @click="openEditor(record.id)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="editOpen"
      :title="t('workflowTemplates.edit')"
      :confirm-loading="saving"
      width="720px"
      @ok="submitEdit"
    >
      <a-form v-if="editForm" layout="vertical">
        <a-alert type="info" :message="t('workflowTemplates.formNodeConfigHint')" show-icon class="mb-4" />
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="t('workflowTemplates.formTopK')">
              <a-input-number v-model:value="editForm.nodeConfig.topK" :min="8" :max="30" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('workflowTemplates.formVariantCount')">
              <a-input-number v-model:value="editForm.nodeConfig.variantCount" :min="1" :max="5" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('workflowTemplates.formPlaybookLimit')">
              <a-input-number v-model:value="editForm.nodeConfig.playbookLimit" :min="1" :max="10" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('workflowTemplates.formMmrLambda')">
              <a-input-number
                v-model:value="editForm.nodeConfig.mmrLambda"
                :min="0"
                :max="1"
                :step="0.05"
                class="w-full"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('workflowTemplates.formPriority')">
              <a-input-number v-model:value="editForm.priority" :min="0" :max="999" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('workflowTemplates.formAbSplit')">
              <a-input-number v-model:value="editForm.abSplitPercent" :min="0" :max="99" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('workflowTemplates.formAbVariant')">
              <a-input :value="editForm.abVariantBId ?? ''" allow-clear @update:value="onAbVariantChange" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('workflowTemplates.formSelectionRules')">
              <a-textarea v-model:value="selectionRulesText" :rows="6" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import type { TablePaginationConfig } from 'ant-design-vue';
import type { WorkflowTemplateInfo } from '@douxing/shared';
import PageContainer from '@/layouts/components/PageContainer.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import { useI18n } from 'vue-i18n';
import { usePageTitle } from '@/i18n/usePageTitle';
import { fetchWorkflowTemplates, updateWorkflowTemplate } from '@/api/workflow-templates';

const router = useRouter();

const { t, locale } = useI18n();
usePageTitle('web.workflowTemplates');

const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const list = ref<WorkflowTemplateInfo[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);

const editOpen = ref(false);
const editForm = ref<WorkflowTemplateInfo | null>(null);
const selectionRulesText = ref('');

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
}));

const columns = computed(() => [
  { title: t('workflowTemplates.colId'), dataIndex: 'id', key: 'id', width: 140 },
  { title: t('workflowTemplates.colName'), key: 'name', width: 160 },
  { title: t('workflowTemplates.colPriority'), dataIndex: 'priority', key: 'priority', width: 88 },
  { title: t('workflowTemplates.colTopK'), key: 'topK', width: 72 },
  { title: t('workflowTemplates.colVariants'), key: 'variants', width: 88 },
  { title: t('workflowTemplates.colVersion'), dataIndex: 'version', key: 'version', width: 72 },
  { title: t('workflowTemplates.colGraphStatus'), key: 'graphStatus', width: 96 },
  { title: t('workflowTemplates.colEnabled'), key: 'enabled', width: 88 },
  { title: t('workflowTemplates.colAb'), key: 'ab', width: 160 },
  { title: t('workflowTemplates.colAction'), key: 'action', width: 180, resizable: false },
]);

/**
 * 加载模板列表。
 *
 * @returns Promise<void>
 */
async function reload() {
  loading.value = true;
  error.value = null;
  try {
    const res = await fetchWorkflowTemplates({ page: page.value, pageSize: pageSize.value });
    list.value = res.items;
    total.value = res.total;
  } catch {
    error.value = t('workflowTemplates.loadFailed');
    message.error(t('workflowTemplates.loadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 表格分页变更。
 *
 * @param pag - Ant Design 分页配置
 */
function handleTableChange(pag: TablePaginationConfig) {
  page.value = pag.current ?? 1;
  pageSize.value = pag.pageSize ?? 20;
  void reload();
}

/**
 * 打开编辑弹窗。
 *
 * @param record - 当前行模板
 */
function openEdit(record: WorkflowTemplateInfo) {
  editForm.value = {
    ...record,
    nodeConfig: { ...record.nodeConfig },
  };
  selectionRulesText.value = JSON.stringify(record.selectionRules, null, 2);
  editOpen.value = true;
}

/**
 * 同步 A/B 对照模板 ID 输入。
 *
 * @param value - 输入值
 */
function onAbVariantChange(value: string): void {
  if (!editForm.value) return;
  editForm.value.abVariantBId = value.trim() ? value : null;
}

/**
 * 打开可视化编排编辑器。
 *
 * @param id - 模板 ID
 */
function openEditor(id: string): void {
  router.push({ name: 'workflow-template-editor', params: { id } });
}

/**
 * 提交模板更新。
 *
 * @returns Promise<void>
 */
async function submitEdit() {
  if (!editForm.value) return;

  let selectionRules: Record<string, unknown> | boolean;
  try {
    selectionRules = JSON.parse(selectionRulesText.value) as Record<string, unknown> | boolean;
  } catch {
    message.error(t('workflowTemplates.invalidJson'));
    return;
  }

  saving.value = true;
  try {
    await updateWorkflowTemplate(editForm.value.id, {
      nodeConfig: editForm.value.nodeConfig,
      priority: editForm.value.priority,
      abSplitPercent: editForm.value.abSplitPercent,
      abVariantBId: editForm.value.abVariantBId || null,
      selectionRules,
      enabled: editForm.value.enabled,
    });
    message.success(t('workflowTemplates.saveSuccess'));
    editOpen.value = false;
    await reload();
  } catch {
    message.error(t('workflowTemplates.saveFailed'));
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void reload();
});
</script>

<style scoped>
.mb-4 {
  margin-bottom: 16px;
}
.w-full {
  width: 100%;
}
</style>
