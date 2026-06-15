<template>
  <PageContainer admin>
    <template #search>
      <AdminSearchBar @search="load" @reset="resetSearch">
        <a-form-item :label="t('membershipAdmin.colProductId')">
          <a-input-number
            v-model:value="productIdFilter"
            :min="1"
            :placeholder="t('membershipAdmin.searchProductId')"
            style="width: 140px"
          />
        </a-form-item>
        <a-form-item :label="t('membershipAdmin.colLevel')">
          <a-select
            v-model:value="levelFilter"
            :options="levelOptions"
            allow-clear
            style="width: 160px"
            :placeholder="t('membershipAdmin.allLevels')"
          />
        </a-form-item>
      </AdminSearchBar>
    </template>

    <template #toolbar>
      <AdminToolbar>
        <template #right>
          <a-tooltip :title="t('common.refresh')">
            <a-button :loading="loading" @click="load">
              <template #icon><ReloadOutlined /></template>
            </a-button>
          </a-tooltip>
        </template>
      </AdminToolbar>
    </template>

    <DouxingAdminTable
      :columns="columns"
      :data-source="products"
      :loading="loading"
      :empty-text="t('membershipAdmin.emptyProducts')"
      row-key="id"
      :pagination="false"
    />
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ReloadOutlined } from '@ant-design/icons-vue';
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import {
  getMemberLevelI18nKey,
  MemberLevel,
  type MembershipProduct,
} from '@douxing/shared';
import { fetchMembershipProducts } from '@/api/membership';
import AdminSearchBar from '@/components/admin/AdminSearchBar.vue';
import AdminToolbar from '@/components/admin/AdminToolbar.vue';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.membershipProducts');

const { t } = useI18n();
const loading = ref(false);
const products = ref<MembershipProduct[]>([]);
const productIdFilter = ref<number | undefined>();
const levelFilter = ref<number | undefined>();

const levelOptions = computed(() => [
  { label: t(getMemberLevelI18nKey(MemberLevel.SILVER)), value: MemberLevel.SILVER },
  { label: t(getMemberLevelI18nKey(MemberLevel.GOLD)), value: MemberLevel.GOLD },
  { label: t(getMemberLevelI18nKey(MemberLevel.VIP)), value: MemberLevel.VIP },
]);

function memberLevelLabel(level: number) {
  return t(getMemberLevelI18nKey(level));
}

const columns = computed<TableColumnsType<MembershipProduct>>(() => [
  { title: t('membershipAdmin.colProductId'), dataIndex: 'id', width: 90 },
  {
    title: t('membershipAdmin.colLevel'),
    dataIndex: 'targetLevel',
    width: 120,
    customRender: ({ text }) => memberLevelLabel(Number(text)),
  },
  {
    title: t('membershipAdmin.colDuration'),
    dataIndex: 'durationDays',
    width: 120,
    customRender: ({ text }) => t('membershipAdmin.durationDays', { days: text }),
  },
  {
    title: t('membershipAdmin.colPrice'),
    dataIndex: 'price',
    width: 120,
    customRender: ({ text }) => `¥${text}`,
  },
]);

function resetSearch() {
  productIdFilter.value = undefined;
  levelFilter.value = undefined;
  void load();
}

async function load() {
  loading.value = true;
  try {
    products.value = await fetchMembershipProducts({
      productId: productIdFilter.value,
      targetLevel: levelFilter.value,
    });
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
