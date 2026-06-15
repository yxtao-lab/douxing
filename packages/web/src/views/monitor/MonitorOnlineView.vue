<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('system.colUsername')">
          <a-input
            v-model:value="keyword"
            :placeholder="t('system.searchOnlineKeyword')"
            allow-clear
            style="width: 240px"
            @press-enter="load"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <AdminTableExportButton :columns="columns" :rows="items" name-key="web.monitorOnline" />
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
      row-key="userId"
      :pagination="false"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { fetchOnlineUsers, type OnlineUserRow } from '@/api/system';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminTableExportButton from '@/components/admin/AdminTableExportButton.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.monitorOnline');

const { t } = useI18n();
const keyword = ref('');
const items = ref<OnlineUserRow[]>([]);
const loading = ref(false);

const columns = computed<TableColumnsType<OnlineUserRow>>(() => [
  { title: t('system.colUsername'), dataIndex: 'username', width: 120 },
  { title: t('system.colNickname'), dataIndex: 'nickname', width: 120 },
  { title: t('system.colOperIp'), dataIndex: 'ip', width: 140 },
  {
    title: t('system.loginTime'),
    dataIndex: 'loginTime',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 19).replace('T', ' '),
  },
  {
    title: t('system.lastActive'),
    dataIndex: 'lastActive',
    width: 160,
    customRender: ({ text }) => String(text).slice(0, 19).replace('T', ' '),
  },
]);

function resetSearch() {
  keyword.value = '';
  void load();
}

async function load() {
  loading.value = true;
  try {
    items.value = await fetchOnlineUsers({
      keyword: keyword.value.trim() || undefined,
    });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
