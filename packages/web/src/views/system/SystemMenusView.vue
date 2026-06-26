<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.colMenuName')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchMenu')"
            allow-clear
            style="width: 220px"
            @press-enter="load"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #left>
          <a-button type="primary" @click="openCreate()">
            <template #icon><PlusOutlined /></template>
            {{ t('system.add') }}
          </a-button>
        </template>
        <template #right>
          <AdminTableExportButton
            :columns="columns"
            :rows="items"
            name-key="web.sysMenus"
            flatten-tree
          />
          <a-tooltip :title="t('system.refresh')">
            <a-button :loading="loading" @click="load">
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
      :empty-text="t('system.empty')"
      row-key="id"
      :pagination="false"
      :default-expand-all-rows="true"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'menuName'">
          <span class="menu-name-cell">
            <component :is="renderMenuIcon(record.icon)" v-if="renderMenuIcon(record.icon)" />
            <span>{{ record.menuName }}</span>
          </span>
        </template>
        <template v-else-if="column.key === 'menuType'">
          <a-tag :color="menuTypeColor(record.menuType)">{{ menuTypeLabel(record.menuType) }}</a-tag>
        </template>
        <template v-else-if="column.key === 'visible'">
          <a-tag :color="record.visible === 1 ? 'success' : 'default'">
            {{ record.visible === 1 ? t('system.visibleShow') : t('system.visibleHide') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'success' : 'default'">
            {{ record.status === 1 ? t('system.statusNormal') : t('system.statusDisabled') }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <TableActionBar :show-delete="!record.children?.length" @edit="openEdit(record)" @delete="handleDelete(record)">
            <TableActionButton
              variant="edit"
              :icon="PlusOutlined"
              :label="t('system.addChildMenu')"
              @click="openCreate(record)"
            />
          </TableActionBar>
        </template>
      </template>
    </DouxingAdminTable>

    <a-modal
      v-model:open="modalOpen"
      :title="editingId ? t('system.edit') : t('system.add')"
      width="760px"
      @ok="submit"
      :confirm-loading="saving"
    >
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item :label="t('system.colMenuName')" required>
              <a-input v-model:value="form.menuName" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colParentMenu')" required>
              <a-tree-select
                v-model:value="form.parentId"
                :tree-data="parentTreeOptions"
                tree-default-expand-all
                :dropdown-style="{ maxHeight: '320px', overflow: 'auto' }"
                style="width: 100%"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colSort')" required>
              <a-input-number v-model:value="form.sortOrder" :min="0" class="w-full" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colMenuType')" required>
              <a-select v-model:value="form.menuType" :options="menuTypeOptions" />
            </a-form-item>
          </a-col>
          <a-col v-if="!editingId" :span="12">
            <a-form-item :label="t('system.colMenuKey')" required>
              <a-input v-model:value="form.menuKey" />
            </a-form-item>
          </a-col>
          <a-col :span="editingId ? 12 : 12">
            <a-form-item :label="t('system.menuPath')">
              <a-input v-model:value="form.path" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colComponent')">
              <a-input v-model:value="form.component" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colRouteParams')">
              <a-input v-model:value="form.routeParams" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colIsFrame')" required>
              <a-radio-group v-model:value="form.isFrame" button-style="solid">
                <a-radio-button :value="1">{{ t('system.yesLabel') }}</a-radio-button>
                <a-radio-button :value="0">{{ t('system.noLabel') }}</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colVisible')" required>
              <a-radio-group v-model:value="form.visible" button-style="solid">
                <a-radio-button :value="1">{{ t('system.yesLabel') }}</a-radio-button>
                <a-radio-button :value="0">{{ t('system.noLabel') }}</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colStatus')" required>
              <a-radio-group v-model:value="form.status" button-style="solid">
                <a-radio-button :value="1">{{ t('system.statusNormal') }}</a-radio-button>
                <a-radio-button :value="0">{{ t('system.statusDisabled') }}</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colIcon')">
              <MenuIconPicker v-model="form.icon" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="t('system.colPerms')">
              <a-input v-model:value="form.perms" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item :label="t('system.colRemark')">
              <a-textarea v-model:value="form.remark" :rows="2" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { message, Modal } from 'ant-design-vue';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import {
  createMenu,
  deleteMenu,
  fetchMenusTree,
  updateMenu,
  type MenuRow,
} from '@/api/system';
import { useMenuStore } from '@/stores/menu';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import TableActionBar from '@/components/admin/TableActionBar.vue';
import TableActionButton from '@/components/admin/TableActionButton.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import MenuIconPicker from '@/components/admin/MenuIconPicker.vue';
import { renderMenuIcon } from '@/composables/useAppMenu';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';
import type { AdminExportColumn } from '@/utils/adminTableExport';

usePageTitle('web.sysMenus');

const MENU_TYPE = {
  DIRECTORY: 1,
  MENU: 2,
  BUTTON: 3,
} as const;

const { t } = useI18n();
const menuStore = useMenuStore();
const items = ref<MenuRow[]>([]);
const loading = ref(false);
const keyword = ref('');
const modalOpen = ref(false);
const saving = ref(false);
const editingId = ref<number | null>(null);

const form = reactive({
  parentId: 0,
  menuKey: '',
  menuName: '',
  menuType: MENU_TYPE.MENU as number,
  path: '',
  component: '',
  perms: '',
  icon: undefined as string | undefined,
  sortOrder: 0,
  isFrame: 0,
  visible: 1,
  status: 1,
  routeParams: '',
  remark: '',
});

const columns = computed<AdminExportColumn<MenuRow>[]>(() => [
  {
    title: t('system.colMenuName'),
    key: 'menuName',
    dataIndex: 'menuName',
    width: 220,
    exportValue: (record) => record.menuName,
  },
  { title: t('system.menuPath'), dataIndex: 'path', width: 160, ellipsis: true },
  { title: t('system.colPerms'), dataIndex: 'perms', width: 160, ellipsis: true },
  {
    title: t('system.colMenuType'),
    key: 'menuType',
    dataIndex: 'menuType',
    width: 90,
    exportValue: (record) => menuTypeLabel(record.menuType),
  },
  {
    title: t('system.colVisible'),
    key: 'visible',
    dataIndex: 'visible',
    width: 90,
    exportValue: (record) =>
      record.visible === 1 ? t('system.visibleShow') : t('system.visibleHide'),
  },
  {
    title: t('system.colStatus'),
    key: 'status',
    dataIndex: 'status',
    width: 90,
    exportValue: (record) =>
      record.status === 1 ? t('system.statusNormal') : t('system.statusDisabled'),
  },
  { title: t('system.colSort'), dataIndex: 'sortOrder', width: 72 },
  { title: t('system.colAction'), key: 'action', width: 260, fixed: 'right' },
]);

const menuTypeOptions = computed(() => [
  { label: t('system.menuTypeDirectory'), value: MENU_TYPE.DIRECTORY },
  { label: t('system.menuTypeMenu'), value: MENU_TYPE.MENU },
  { label: t('system.menuTypeButton'), value: MENU_TYPE.BUTTON },
]);

function flattenMenus(nodes: MenuRow[]): MenuRow[] {
  const result: MenuRow[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children?.length) result.push(...flattenMenus(node.children));
  }
  return result;
}

function collectDescendantIds(nodes: MenuRow[], rootId: number): Set<number> {
  const flat = flattenMenus(nodes);
  const byParent = new Map<number, number[]>();
  for (const row of flat) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row.id);
    byParent.set(row.parentId, list);
  }
  const ids = new Set<number>();
  function walk(id: number) {
    for (const childId of byParent.get(id) ?? []) {
      ids.add(childId);
      walk(childId);
    }
  }
  walk(rootId);
  return ids;
}

function buildParentTree(
  nodes: MenuRow[],
  excludeIds: Set<number>,
): Array<{ value: number; title: string; children?: ReturnType<typeof buildParentTree> }> {
  return nodes
    .filter((node) => !excludeIds.has(node.id))
    .map((node) => {
      const children = node.children?.length
        ? buildParentTree(node.children, excludeIds)
        : undefined;
      return {
        value: node.id,
        title: node.menuName,
        children: children?.length ? children : undefined,
      };
    });
}

const parentTreeOptions = computed(() => {
  const excludeIds = editingId.value
    ? new Set([editingId.value, ...collectDescendantIds(items.value, editingId.value)])
    : new Set<number>();
  return [
    { value: 0, title: t('system.parentMenuRoot') },
    ...buildParentTree(items.value, excludeIds),
  ];
});

function menuTypeLabel(type: number) {
  if (type === MENU_TYPE.DIRECTORY) return t('system.menuTypeDirectory');
  if (type === MENU_TYPE.BUTTON) return t('system.menuTypeButton');
  return t('system.menuTypeMenu');
}

function menuTypeColor(type: number) {
  if (type === MENU_TYPE.DIRECTORY) return 'processing';
  if (type === MENU_TYPE.BUTTON) return 'default';
  return 'cyan';
}

function resetForm() {
  form.parentId = 0;
  form.menuKey = '';
  form.menuName = '';
  form.menuType = MENU_TYPE.MENU as number;
  form.path = '';
  form.component = '';
  form.perms = '';
  form.icon = undefined;
  form.sortOrder = 0;
  form.isFrame = 0;
  form.visible = 1;
  form.status = 1;
  form.routeParams = '';
  form.remark = '';
}

async function load() {
  loading.value = true;
  try {
    items.value = await fetchMenusTree(keyword.value.trim() || undefined);
  } finally {
    loading.value = false;
  }
}

function resetSearch() {
  keyword.value = '';
  void load();
}

function openCreate(parent?: MenuRow) {
  editingId.value = null;
  resetForm();
  if (parent) {
    form.parentId = parent.id;
    form.menuType = parent.menuType === MENU_TYPE.BUTTON ? MENU_TYPE.BUTTON : MENU_TYPE.MENU;
    form.sortOrder = (parent.children?.length ?? 0) + 1;
  }
  modalOpen.value = true;
}

function openEdit(record: MenuRow) {
  editingId.value = record.id;
  form.parentId = record.parentId;
  form.menuKey = record.menuKey;
  form.menuName = record.menuName;
  form.menuType = record.menuType;
  form.path = record.path ?? '';
  form.component = record.component ?? '';
  form.perms = record.perms ?? '';
  form.icon = record.icon ?? undefined;
  form.sortOrder = record.sortOrder;
  form.isFrame = record.isFrame;
  form.visible = record.visible;
  form.status = record.status;
  form.routeParams = record.routeParams ?? '';
  form.remark = record.remark ?? '';
  modalOpen.value = true;
}

function buildPayload() {
  return {
    parentId: form.parentId,
    menuKey: form.menuKey.trim(),
    menuName: form.menuName.trim(),
    menuType: form.menuType,
    path: form.path.trim() || null,
    component: form.component.trim() || null,
    perms: form.perms.trim() || null,
    icon: form.icon || null,
    sortOrder: form.sortOrder,
    isFrame: form.isFrame,
    visible: form.visible,
    status: form.status,
    routeParams: form.routeParams.trim() || null,
    remark: form.remark.trim() || null,
  };
}

async function submit() {
  if (!form.menuName.trim()) {
    message.warning(t('system.colMenuName'));
    return;
  }
  if (!editingId.value && !form.menuKey.trim()) {
    message.warning(t('system.colMenuKey'));
    return;
  }

  saving.value = true;
  try {
    const payload = buildPayload();
    if (editingId.value) {
      const { menuKey: _menuKey, ...updateBody } = payload;
      await updateMenu(editingId.value, updateBody);
    } else {
      await createMenu(payload);
    }
    message.success(t('common.success'));
    modalOpen.value = false;
    await load();
    void menuStore.loadNavTree(true);
  } catch (err) {
    message.error(err instanceof Error ? err.message : t('common.failed'));
  } finally {
    saving.value = false;
  }
}

function handleDelete(record: MenuRow) {
  Modal.confirm({
    title: t('system.confirmDelete'),
    onOk: async () => {
      try {
        await deleteMenu(record.id);
        message.success(t('common.success'));
        await load();
        void menuStore.loadNavTree(true);
      } catch (err) {
        message.error(err instanceof Error ? err.message : t('common.failed'));
      }
    },
  });
}

onMounted(load);
</script>

<style scoped>
.menu-name-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.menu-name-cell :deep(.anticon) {
  color: var(--color-primary);
}
</style>
