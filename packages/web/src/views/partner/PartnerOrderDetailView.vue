<template>
  <PageContainer :title="t('partner.orderDetailTitle')" :description="order?.orderNo">
    <template #extra>
      <a-button @click="$router.push({ name: 'partner-orders' })">
        {{ t('partner.backToOrders') }}
      </a-button>
    </template>

    <a-spin :spinning="loading">
      <a-card v-if="order" class="detail-card">
        <h2 class="detail-title">{{ order.demandTitle || order.productTitle || order.orderNo }}</h2>
        <p class="detail-amount">¥{{ order.totalAmount }}</p>
        <p class="detail-meta">{{ orderStatusLabel(order.status) }}</p>

        <div v-if="order.demandStartDate || order.demandEndDate" class="detail-section">
          <h3 class="detail-section-title">{{ t('partner.scheduleSection') }}</h3>
          <p class="detail-line">
            {{ t('partner.colTripDates') }}：
            {{ formatTripDates(order.demandStartDate, order.demandEndDate) }}
          </p>
        </div>

        <div v-if="order.sellerOrgId" class="detail-section">
          <h3 class="detail-section-title">{{ t('partner.assignSection') }}</h3>
          <p v-if="order.assignedGuideUserId" class="detail-line">
            {{ t('partner.currentGuide') }}：
            {{ order.assignedGuideNickname || order.assignedGuideUsername || order.assignedGuideUserId }}
          </p>
          <p v-else class="detail-line detail-muted">{{ t('partner.guideUnassigned') }}</p>
          <div class="assign-row">
            <a-select
              v-model:value="selectedGuideId"
              :placeholder="t('partner.selectGuide')"
              style="min-width: 220px"
              allow-clear
              :options="guideOptions"
              :loading="membersLoading"
            />
            <a-button type="primary" :loading="assigning" @click="handleAssign">
              {{ t('partner.assignGuide') }}
            </a-button>
            <a-button
              v-if="order.assignedGuideUserId"
              :loading="assigning"
              @click="handleClearAssign"
            >
              {{ t('partner.clearGuide') }}
            </a-button>
          </div>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">{{ t('partner.reportSection') }}</h3>

          <template v-if="canSubmitReport">
            <a-radio-group v-model:value="reportType" class="report-type">
              <a-radio-button :value="ServiceOrderReportType.CHECKIN">
                {{ t('marketplace.reportType.checkin') }}
              </a-radio-button>
              <a-radio-button :value="ServiceOrderReportType.REPORT">
                {{ t('marketplace.reportType.report') }}
              </a-radio-button>
            </a-radio-group>
            <a-textarea
              v-model:value="reportContent"
              :rows="3"
              :placeholder="t('partner.reportContentPlaceholder')"
              class="report-content"
            />
            <a-input
              v-if="reportType === ServiceOrderReportType.CHECKIN"
              v-model:value="reportPlaceName"
              :placeholder="t('partner.reportPlacePlaceholder')"
              class="report-place"
            />
            <div class="report-photos">
              <a-upload
                list-type="picture-card"
                :file-list="photoFileList"
                :before-upload="beforeUploadPhoto"
                :custom-request="handleUploadPhoto"
                @remove="handleRemovePhoto"
              >
                <div v-if="photoUrls.length < 9">
                  <PlusOutlined />
                  <div class="ant-upload-text">{{ t('partner.reportUploadPhoto') }}</div>
                </div>
              </a-upload>
            </div>
            <a-button type="primary" :loading="submittingReport" @click="handleSubmitReport">
              {{ t('partner.submitReport') }}
            </a-button>
          </template>
          <p v-else class="detail-muted">{{ t('partner.reportUnavailable') }}</p>

          <a-timeline v-if="reports.length > 0" class="report-timeline">
            <a-timeline-item v-for="item in reports" :key="item.id">
              <p class="report-item-title">
                {{ reportTypeLabel(item.reportType) }}
                ·
                {{ formatAdminDateTime(item.createdAt) }}
              </p>
              <p v-if="item.authorNickname || item.authorUsername" class="report-item-meta">
                {{ item.authorNickname || item.authorUsername }}
              </p>
              <p v-if="item.placeName" class="report-item-meta">
                {{ t('partner.reportPlace') }}：{{ item.placeName }}
              </p>
              <p v-if="item.content" class="report-item-content">{{ item.content }}</p>
              <div v-if="item.photos.length > 0" class="report-item-photos">
                <a-image
                  v-for="(url, idx) in item.photos"
                  :key="`${item.id}-${idx}`"
                  :src="url"
                  :width="72"
                  :height="72"
                  class="report-thumb"
                />
              </div>
            </a-timeline-item>
          </a-timeline>
          <p v-else class="detail-muted">{{ t('partner.reportsEmpty') }}</p>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">{{ t('partner.reviewSection') }}</h3>

          <template v-if="reviewableBySeller">
            <a-button type="primary" class="detail-action" @click="reviewModalOpen = true">
              {{ t('partner.reviewFromSeller') }}
            </a-button>
          </template>

          <a-timeline v-if="reviews.length > 0" class="report-timeline">
            <a-timeline-item v-for="item in reviews" :key="item.id">
              <p class="report-item-title">
                {{ reviewTargetTypeLabel(item.targetType) }}
                ·
                {{ reviewRatingLabel(item.rating) }}
                ·
                {{ formatAdminDateTime(item.createdAt) }}
              </p>
              <p class="report-item-meta">
                {{ t('partner.reviewColFrom') }}：{{ item.fromNickname || item.fromUsername || item.fromUserId }}
              </p>
              <p v-if="item.content" class="report-item-content">{{ item.content }}</p>
              <div v-if="item.replyContent" class="detail-reply">
                <strong>{{ t('partner.reviewReplySection') }}：</strong>
                {{ item.replyContent }}
                <span class="detail-muted">（{{ formatAdminDateTime(item.replyAt) }}）</span>
              </div>
              <a-button
                v-if="canReplyToReview(item)"
                type="link"
                size="small"
                @click="openReplyModal(item)"
              >
                {{ t('partner.reviewReply') }}
              </a-button>
            </a-timeline-item>
          </a-timeline>
          <p v-else class="detail-muted">{{ t('partner.reviewEmpty') }}</p>
        </div>

        <div class="detail-section">
          <h3 class="detail-section-title">{{ t('partner.disputeSection') }}</h3>
          <a-timeline v-if="disputes.length > 0" class="report-timeline">
            <a-timeline-item v-for="item in disputes" :key="item.id">
              <p class="report-item-title">
                {{ disputeTypeLabel(item.type) }}
                ·
                {{ disputeStatusLabel(item.status) }}
                ·
                {{ formatAdminDateTime(item.createdAt) }}
              </p>
              <p class="report-item-meta">{{ item.reason }}</p>
              <p v-if="item.platformNote" class="detail-reply">
                <strong>{{ t('marketplace.disputePlatformNote') }}：</strong>
                {{ item.platformNote }}
              </p>
            </a-timeline-item>
          </a-timeline>
          <p v-else class="detail-muted">{{ t('partner.disputeEmpty') }}</p>
        </div>

        <a-button
          v-if="nextStatus"
          type="primary"
          class="detail-action"
          :loading="advancing"
          @click="handleAdvance"
        >
          {{ t('partner.advanceOrder', { status: orderStatusLabel(nextStatus) }) }}
        </a-button>
      </a-card>
    </a-spin>

    <a-modal
      v-model:open="reviewModalOpen"
      :title="t('partner.reviewFromSeller')"
      :confirm-loading="submittingReview"
      @ok="handleSubmitReview"
      @cancel="reviewModalOpen = false"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('marketplace.reviewRating.label')">
          <a-rate v-model:value="reviewRating" :count="5" />
        </a-form-item>
        <a-form-item :label="t('partner.reviewReplyPlaceholder')">
          <a-textarea
            v-model:value="reviewContent"
            :rows="4"
            :maxlength="2000"
            :placeholder="t('partner.reviewReplyPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="replyModalOpen"
      :title="t('partner.reviewReplyTitle')"
      :confirm-loading="submittingReply"
      @ok="handleSubmitReply"
      @cancel="closeReplyModal"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('partner.reviewReplyPlaceholder')">
          <a-textarea
            v-model:value="replyContent"
            :rows="4"
            :maxlength="2000"
            :placeholder="t('partner.reviewReplyPlaceholder')"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </PageContainer>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { PlusOutlined } from '@ant-design/icons-vue';
import {
  ServiceOrderDisputeSummary,
  ServiceOrderReportType,
  ServiceOrderReviewSummary,
  ServiceOrderReviewTargetType,
  ServiceOrderStatus,
  type OrgMemberListItem,
  type ServiceOrderDetail,
  type ServiceOrderReportSummary,
} from '@douxing/shared';
import type { UploadFile, UploadProps } from 'ant-design-vue';
import {
  advanceSellerMarketplaceOrder,
  assignMarketplaceOrderGuide,
  createMarketplaceOrderReport,
  fetchMarketplaceOrderDetail,
  fetchMarketplaceOrderReports,
  fetchOrgMembers,
  uploadMarketplaceOrderReportPhoto,
} from '@/api/marketplace-partner';
import {
  createMarketplaceOrderReview,
  fetchMarketplaceOrderDisputes,
  fetchMarketplaceOrderReviews,
  replyMarketplaceOrderReview,
} from '@/api/marketplace';
import PageContainer from '@/layouts/components/PageContainer.vue';
import { useLocale } from '@/i18n/useLocale';
import { usePageTitle } from '@/i18n/usePageTitle';
import { formatAdminDateTime } from '@/utils/adminDateTime';
import { getAppErrorMessage } from '@/utils/error-message';
import { message } from 'ant-design-vue';

usePageTitle('partner.orderDetailTitle');
const { t } = useLocale();
const route = useRoute();

const orderId = computed(() => Number(route.params.id));
const loading = ref(true);
const advancing = ref(false);
const assigning = ref(false);
const membersLoading = ref(false);
const submittingReport = ref(false);
const order = ref<ServiceOrderDetail | null>(null);
const members = ref<OrgMemberListItem[]>([]);
const selectedGuideId = ref<number | undefined>();
const reports = ref<ServiceOrderReportSummary[]>([]);
const reviews = ref<ServiceOrderReviewSummary[]>([]);
const disputes = ref<ServiceOrderDisputeSummary[]>([]);
const reviewModalOpen = ref(false);
const reviewRating = ref(5);
const reviewContent = ref('');
const submittingReview = ref(false);
const replyModalOpen = ref(false);
const replyTarget = ref<ServiceOrderReviewSummary | null>(null);
const replyContent = ref('');
const submittingReply = ref(false);
const reportType = ref(ServiceOrderReportType.CHECKIN);
const reportContent = ref('');
const reportPlaceName = ref('');
const photoUrls = ref<string[]>([]);
const photoFileList = ref<UploadFile[]>([]);

const NEXT_STATUS: Partial<Record<string, string>> = {
  [ServiceOrderStatus.PAID]: ServiceOrderStatus.IN_PROGRESS,
  [ServiceOrderStatus.IN_PROGRESS]: ServiceOrderStatus.DELIVERED,
  [ServiceOrderStatus.DELIVERED]: ServiceOrderStatus.CONFIRMED,
};

const nextStatus = computed(() => (order.value ? NEXT_STATUS[order.value.status] : undefined));

const canSubmitReport = computed(() => {
  const status = order.value?.status;
  return status === ServiceOrderStatus.IN_PROGRESS || status === ServiceOrderStatus.DELIVERED;
});

const canSubmitReview = computed(() => {
  const status = order.value?.status;
  return status === ServiceOrderStatus.CONFIRMED || status === ServiceOrderStatus.DELIVERED;
});

const hasReviewedBuyer = computed(() =>
  reviews.value.some((r) => r.targetType === ServiceOrderReviewTargetType.BUYER),
);

const reviewableBySeller = computed(() => canSubmitReview.value && !hasReviewedBuyer.value);

const guideOptions = computed(() =>
  members.value.map((m) => ({
    value: m.userId,
    label: `${m.nickname || m.username || m.userId}（${orgRoleLabel(m.orgRole)}）`,
  })),
);

/**
 * 解析订单状态展示名。
 *
 * @param status - 状态值
 * @returns 本地化标签
 */
function orderStatusLabel(status: string) {
  const key = `marketplace.orderStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 解析汇报类型展示名。
 *
 * @param type - checkin / report
 * @returns 本地化标签
 */
function reportTypeLabel(type: string) {
  const key = `marketplace.reportType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

/**
 * 解析商户角色展示名。
 *
 * @param role - org_role 值
 * @returns 本地化标签
 */
function orgRoleLabel(role: string) {
  const key = `partner.orgRole.${role}`;
  const label = t(key);
  return label !== key ? label : role;
}

/**
 * 将评价方类型转为展示文案。
 *
 * @param targetType - buyer / seller
 * @returns 本地化标签
 */
function reviewTargetTypeLabel(targetType: string) {
  const key = `marketplace.reviewTargetType.${targetType}`;
  const label = t(key);
  return label !== key ? label : targetType;
}

/**
 * 将星级转为展示文案。
 *
 * @param rating - 1～5
 * @returns 本地化标签
 */
function reviewRatingLabel(rating: number) {
  return t('marketplace.reviewRating.star', { rating });
}

/**
 * 判断当前用户是否可以回复某条评价。
 *
 * @param review - 评价摘要
 * @returns 可回复为 true
 */
function canReplyToReview(review: ServiceOrderReviewSummary): boolean {
  if (review.replyContent && review.replyContent.trim().length > 0) return false;
  if (review.targetType !== ServiceOrderReviewTargetType.BUYER) return false;
  // 卖方评价买方：被回复的是买方评价；当前用户须为卖方
  if (order.value?.sellerProviderUserId === undefined && order.value?.sellerOrgId == null) return false;
  if (order.value?.sellerProviderUserId != null && order.value?.sellerProviderUserId !== review.toUserId) {
    return false;
  }
  return true;
}

/**
 * 将争议类型转为展示文案。
 *
 * @param type - 争议类型值
 * @returns 本地化标签
 */
function disputeTypeLabel(type: string) {
  const key = `marketplace.disputeType.${type}`;
  const label = t(key);
  return label !== key ? label : type;
}

/**
 * 将争议状态转为展示文案。
 *
 * @param status - 争议状态值
 * @returns 本地化标签
 */
function disputeStatusLabel(status: string) {
  const key = `marketplace.disputeStatus.${status}`;
  const label = t(key);
  return label !== key ? label : status;
}

/**
 * 格式化行程起止日展示。
 *
 * @param start - 开始日 YYYY-MM-DD；可空
 * @param end - 结束日 YYYY-MM-DD；可空
 * @returns 展示文案
 */
function formatTripDates(start: string | null, end: string | null) {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return start;
  if (end) return end;
  return t('partner.tripDatesEmpty');
}

/**
 * 加载订单详情与汇报时间线。
 *
 * @returns 无返回值
 */
async function load() {
  loading.value = true;
  try {
    order.value = await fetchMarketplaceOrderDetail(orderId.value);
    selectedGuideId.value = order.value.assignedGuideUserId ?? undefined;
    if (order.value.sellerOrgId != null) {
      await loadMembers(order.value.sellerOrgId);
    } else {
      members.value = [];
    }
    await loadReports();
    await loadReviews();
    await loadDisputes();
  } finally {
    loading.value = false;
  }
}

/**
 * 加载商户成员候选列表。
 *
 * @param orgId - 商户 ID
 * @returns 无返回值
 */
async function loadMembers(orgId: number) {
  membersLoading.value = true;
  try {
    members.value = await fetchOrgMembers(orgId);
  } catch (error) {
    members.value = [];
    message.error(getAppErrorMessage(error, t('partner.assignFailed')));
  } finally {
    membersLoading.value = false;
  }
}

/**
 * 加载履约汇报时间线。
 *
 * @returns 无返回值
 */
async function loadReports() {
  try {
    reports.value = await fetchMarketplaceOrderReports(orderId.value);
  } catch {
    reports.value = [];
  }
}

/**
 * 加载订单评价列表。
 *
 * @returns 无返回值
 */
async function loadReviews() {
  try {
    const result = await fetchMarketplaceOrderReviews(orderId.value);
    reviews.value = result.items ?? [];
  } catch {
    reviews.value = [];
  }
}

/**
 * 加载订单争议列表。
 *
 * @returns 无返回值
 */
async function loadDisputes() {
  try {
    const result = await fetchMarketplaceOrderDisputes(orderId.value);
    disputes.value = result.items ?? [];
  } catch {
    disputes.value = [];
  }
}

/**
 * 推进履约状态至下一合法节点。
 *
 * @returns 无返回值
 */
async function handleAdvance() {
  if (!order.value || !nextStatus.value) return;
  advancing.value = true;
  try {
    order.value = await advanceSellerMarketplaceOrder(orderId.value, {
      status: nextStatus.value as ServiceOrderDetail['status'],
    });
    message.success(t('partner.advanceSuccess'));
  } finally {
    advancing.value = false;
  }
}

/**
 * 提交领队指派。
 *
 * @returns 无返回值
 */
async function handleAssign() {
  if (selectedGuideId.value == null) {
    message.warning(t('partner.selectGuide'));
    return;
  }
  assigning.value = true;
  try {
    order.value = await assignMarketplaceOrderGuide(orderId.value, {
      guideUserId: selectedGuideId.value,
    });
    message.success(t('partner.assignSuccess'));
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.assignFailed')));
  } finally {
    assigning.value = false;
  }
}

/**
 * 清除领队指派。
 *
 * @returns 无返回值
 */
async function handleClearAssign() {
  assigning.value = true;
  try {
    order.value = await assignMarketplaceOrderGuide(orderId.value, { guideUserId: null });
    selectedGuideId.value = undefined;
    message.success(t('partner.clearGuideSuccess'));
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.assignFailed')));
  } finally {
    assigning.value = false;
  }
}

/**
 * 上传前校验：仅图片且未超 9 张。
 *
 * @param file - 待上传文件
 * @returns 始终 false，改走 customRequest
 */
function beforeUploadPhoto(file: File) {
  if (!file.type.startsWith('image/')) {
    message.warning(t('partner.reportPhotoInvalid'));
    return false;
  }
  if (photoUrls.value.length >= 9) {
    message.warning(t('partner.reportPhotoLimit'));
    return false;
  }
  return true;
}

/**
 * 自定义上传汇报图片。
 *
 * @param options - Ant Upload 自定义请求参数
 * @returns 无返回值
 */
const handleUploadPhoto: UploadProps['customRequest'] = async (options) => {
  const file = options.file as File;
  try {
    const result = await uploadMarketplaceOrderReportPhoto(orderId.value, file);
    photoUrls.value = [...photoUrls.value, result.fileUrl];
    photoFileList.value = [
      ...photoFileList.value,
      {
        uid: `${Date.now()}`,
        name: result.fileName,
        status: 'done',
        url: result.publicUrl,
      },
    ];
    options.onSuccess?.(result);
  } catch (error) {
    options.onError?.(error as Error);
    message.error(getAppErrorMessage(error, t('partner.reportUploadFailed')));
  }
};

/**
 * 移除已上传图片。
 *
 * @param file - 被移除的文件项
 * @returns 是否允许移除
 */
function handleRemovePhoto(file: UploadFile) {
  const idx = photoFileList.value.findIndex((item) => item.uid === file.uid);
  if (idx >= 0) {
    photoFileList.value = photoFileList.value.filter((_, i) => i !== idx);
    photoUrls.value = photoUrls.value.filter((_, i) => i !== idx);
  }
  return true;
}

/**
 * 提交履约汇报。
 *
 * @returns 无返回值
 */
async function handleSubmitReport() {
  submittingReport.value = true;
  try {
    await createMarketplaceOrderReport(orderId.value, {
      reportType: reportType.value,
      content: reportContent.value.trim() || undefined,
      placeName: reportPlaceName.value.trim() || undefined,
      photos: photoUrls.value.length > 0 ? photoUrls.value : undefined,
    });
    message.success(t('partner.reportSuccess'));
    reportContent.value = '';
    reportPlaceName.value = '';
    photoUrls.value = [];
    photoFileList.value = [];
    await loadReports();
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.reportFailed')));
  } finally {
    submittingReport.value = false;
  }
}

/**
 * 提交卖方对买方的评价。
 *
 * @returns 无返回值
 */
async function handleSubmitReview() {
  if (!reviewableBySeller.value) return;
  submittingReview.value = true;
  try {
    await createMarketplaceOrderReview(orderId.value, {
      targetType: ServiceOrderReviewTargetType.BUYER,
      rating: reviewRating.value,
      content: reviewContent.value.trim() || undefined,
    });
    message.success(t('partner.reviewReplySuccess'));
    reviewModalOpen.value = false;
    reviewContent.value = '';
    reviewRating.value = 5;
    await loadReviews();
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.reviewReplyFailed')));
  } finally {
    submittingReview.value = false;
  }
}

/**
 * 打开回复评价弹窗。
 *
 * @param review - 被回复的评价
 * @returns 无返回值
 */
function openReplyModal(review: ServiceOrderReviewSummary) {
  replyTarget.value = review;
  replyContent.value = '';
  replyModalOpen.value = true;
}

/**
 * 关闭回复弹窗。
 */
function closeReplyModal() {
  replyModalOpen.value = false;
  replyTarget.value = null;
  replyContent.value = '';
}

/**
 * 提交对买方评价的回复。
 *
 * @returns 无返回值
 */
async function handleSubmitReply() {
  if (!replyTarget.value) return;
  submittingReply.value = true;
  try {
    await replyMarketplaceOrderReview(orderId.value, replyTarget.value.id, {
      replyContent: replyContent.value.trim(),
    });
    message.success(t('partner.reviewReplySuccess'));
    closeReplyModal();
    await loadReviews();
  } catch (error) {
    message.error(getAppErrorMessage(error, t('partner.reviewReplyFailed')));
  } finally {
    submittingReply.value = false;
  }
}

watch(orderId, () => {
  void load();
});

onMounted(load);
</script>

<style scoped>
.detail-card {
  max-width: 720px;
}

.detail-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.detail-amount {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary);
}

.detail-meta {
  margin: 0;
  color: #6b7280;
}

.detail-section {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.detail-section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.detail-line {
  margin: 0 0 8px;
  color: #374151;
}

.detail-muted {
  color: #9ca3af;
}

.assign-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.report-type {
  margin-bottom: 12px;
}

.report-content,
.report-place {
  margin-bottom: 12px;
}

.report-photos {
  margin-bottom: 12px;
}

.report-timeline {
  margin-top: 20px;
}

.report-item-title {
  margin: 0 0 4px;
  font-weight: 600;
}

.report-item-meta {
  margin: 0 0 4px;
  color: #6b7280;
  font-size: 12px;
}

.report-item-content {
  margin: 0 0 8px;
  white-space: pre-wrap;
}

.report-item-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.report-thumb {
  object-fit: cover;
  border-radius: 4px;
}

.detail-action {
  margin-top: 16px;
}
</style>
