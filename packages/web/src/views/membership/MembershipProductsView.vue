<template>
  <PageContainer :title="t('membershipAdmin.productsTitle')" :description="t('membershipAdmin.productsDesc')">
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
import { useI18n } from 'vue-i18n';
import type { TableColumnsType } from 'ant-design-vue';
import { getMemberLevelI18nKey, type MembershipProduct } from '@douxing/shared';
import { fetchMembershipProducts } from '@/api/membership';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { usePageTitle } from '@/i18n/usePageTitle';

usePageTitle('web.membershipProducts');

const { t } = useI18n();
const loading = ref(false);
const products = ref<MembershipProduct[]>([]);

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

onMounted(async () => {
  loading.value = true;
  try {
    products.value = await fetchMembershipProducts();
  } finally {
    loading.value = false;
  }
});
</script>
