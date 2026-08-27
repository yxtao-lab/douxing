<template>
  <a-modal
    :open="visible"
    :title="modalTitle"
    width="720px"
    :footer="null"
    destroy-on-close
    @cancel="emit('close')"
  >
    <a-spin :spinning="loading">
      <DouxingAdminTable
        :columns="columns"
        :data-source="comments"
        :pagination="false"
        row-key="id"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'featured'">
            <a-switch
              :checked="record.isFeatured === true"
              :loading="togglingId === record.id"
              @change="(checked) => handleFeaturedToggle(record, checked === true)"
            />
          </template>
          <template v-else-if="column.key === 'content'">
            <span class="comment-content-cell">{{ record.content }}</span>
          </template>
        </template>
      </DouxingAdminTable>
      <a-empty v-if="!loading && comments.length === 0" :description="t('routes.commentsEmpty')" />
    </a-spin>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RouteCommentInfo, TravelRouteInfo } from '@douxing/shared';
import { fetchRouteComments, setRouteCommentFeatured } from '@/api/routes';
import DouxingAdminTable from '@/components/DouxingAdminTable.vue';
import { message } from 'ant-design-vue';
import type { AdminExportColumn } from '@/utils/adminTableExport';
import { formatAdminTableCell } from '@/utils/adminTableColumns';

const props = defineProps<{
  visible: boolean;
  route: TravelRouteInfo | null;
}>();

const emit = defineEmits<{
  close: [];
  updated: [];
}>();

const { t } = useI18n();
const loading = ref(false);
const togglingId = ref<number | null>(null);
const comments = ref<RouteCommentInfo[]>([]);

const modalTitle = computed(() =>
  props.route
    ? t('routes.commentModerationTitle', { name: props.route.name })
    : t('routes.commentModerationTitleFallback'),
);

const columns = computed<AdminExportColumn<RouteCommentInfo>[]>(() => [
  { title: 'ID', dataIndex: 'id', width: 72 },
  {
    title: t('routes.colCommentUser'),
    dataIndex: 'userNickname',
    width: 120,
    customRender: ({ record }: { record: RouteCommentInfo }) =>
      formatAdminTableCell(record.userNickname),
  },
  {
    title: t('routes.colCommentContent'),
    key: 'content',
    dataIndex: 'content',
    ellipsis: true,
  },
  {
    title: t('routes.colCommentLikes'),
    dataIndex: 'likeCount',
    width: 88,
    customRender: ({ record }: { record: RouteCommentInfo }) =>
      formatAdminTableCell(record.likeCount ?? 0),
  },
  {
    title: t('routes.colCommentFeatured'),
    key: 'featured',
    width: 100,
  },
]);

/**
 * 加载路线评论列表（热门排序）。
 */
async function loadComments() {
  if (!props.route?.id) {
    comments.value = [];
    return;
  }
  loading.value = true;
  try {
    comments.value = await fetchRouteComments(props.route.id, { sort: 'hot', limit: 100 });
  } catch {
    comments.value = [];
    message.error(t('routes.commentModerationLoadFailed'));
  } finally {
    loading.value = false;
  }
}

/**
 * 切换评论精选状态。
 *
 * @param comment - 评论行
 * @param featured - 是否精选
 */
async function handleFeaturedToggle(comment: RouteCommentInfo, featured: boolean) {
  if (!props.route?.id) return;
  togglingId.value = comment.id;
  try {
    const updated = await setRouteCommentFeatured(props.route.id, comment.id, featured);
    comments.value = comments.value.map((c) => (c.id === comment.id ? updated : c));
    message.success(
      featured ? t('routes.commentFeaturedOn') : t('routes.commentFeaturedOff'),
    );
    emit('updated');
  } catch {
    message.error(t('routes.commentFeaturedFailed'));
  } finally {
    togglingId.value = null;
  }
}

watch(
  () => [props.visible, props.route?.id] as const,
  ([open]) => {
    if (open) void loadComments();
  },
);
</script>

<style scoped>
.comment-content-cell {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}
</style>
