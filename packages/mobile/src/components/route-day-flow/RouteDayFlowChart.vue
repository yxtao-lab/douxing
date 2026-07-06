<template>
  <view class="flow-chart">
    <view v-if="showTitle" class="flow-chart-header">
      <text class="flow-chart-title">{{ t('routes.flowChartTitle') }}</text>
    </view>

    <scroll-view
      v-if="showDayTabs && days.length > 1"
      class="day-tabs"
      scroll-x
      enable-flex
      :show-scrollbar="false"
    >
      <view
        v-for="(day, index) in days"
        :key="index"
        class="day-tab"
        :class="{ active: index === resolvedActiveDayIndex }"
        @click="setActiveDayIndex(index)"
      >
        <text>{{ dayTabLabel(day, index) }}</text>
      </view>
    </scroll-view>

    <view v-if="activeDay" class="flow-day">
      <text v-if="days.length === 1" class="flow-day-title">{{ dayHeading(activeDay) }}</text>

      <view v-if="flowNodes.length === 0" class="flow-empty">
        <text>{{ t('routes.flowChartEmpty') }}</text>
      </view>

      <view v-if="activeWarnings.length" class="flow-warnings">
        <text class="flow-warnings-title">{{ t('routes.flowWarningsTitle') }}</text>
        <text
          v-for="(warn, wi) in activeWarnings"
          :key="`warn-${wi}`"
          class="flow-warning-item"
        >
          {{ warn }}
        </text>
      </view>

      <view v-if="flowNodes.length > 0" class="flow-track">
        <view
          v-for="(node, index) in flowNodes"
          :key="`${node.kind}-${index}`"
          class="flow-step"
        >
          <view class="flow-rail">
            <view class="flow-dot" :class="`flow-dot--${node.kind}`" />
            <view v-if="index < flowNodes.length - 1" class="flow-line" />
          </view>

          <view class="flow-card" :class="`flow-card--${node.kind}`">
            <view class="flow-card-head">
              <text class="flow-kind">{{ kindLabel(node.kind) }}</text>
              <text v-if="node.intercity" class="flow-badge">{{ t('routes.flowIntercity') }}</text>
              <text v-if="node.estimated" class="flow-badge flow-badge--warn">
                {{ t('routes.transitEstimated') }}
              </text>
            </view>
            <view class="flow-card-body">
              <view
                v-if="node.kind === 'play' && node.spot?.coverImageUrl"
                class="flow-thumb-wrap"
                role="button"
                :aria-label="t('routes.coverImagePreview')"
                @click.stop="previewCoverImage(node.spot!.coverImageUrl!)"
              >
                <image
                  class="flow-thumb"
                  :src="node.spot.coverImageUrl"
                  mode="aspectFill"
                />
                <view
                  v-if="node.spot.videoUrl"
                  class="flow-video-badge"
                  @click.stop="emitPoiVideoPlay(node.spot)"
                >
                  <text class="flow-video-icon">▶</text>
                </view>
              </view>
              <view
                v-else-if="node.kind === 'play' && node.spot?.videoUrl"
                class="flow-thumb-wrap flow-thumb-wrap--video"
                role="button"
                :aria-label="t('routes.poiPlayVideo')"
                @click.stop="emitPoiVideoPlay(node.spot)"
              >
                <image
                  v-if="node.spot.videoCoverUrl"
                  class="flow-thumb"
                  :src="node.spot.videoCoverUrl"
                  mode="aspectFill"
                />
                <view v-else class="flow-thumb flow-thumb--placeholder" />
                <view class="flow-video-badge">
                  <text class="flow-video-icon">▶</text>
                </view>
              </view>
              <view class="flow-card-main">
                <view
                  v-if="node.kind === 'play' && node.spot"
                  class="flow-title-row"
                  @click="togglePoiExpand(node.spot)"
                >
                  <text class="flow-title">{{ node.title }}</text>
                  <text class="flow-expand-hint">{{ poiExpandHint(node.spot) }}</text>
                </view>
                <text v-else class="flow-title">{{ node.title }}</text>
                <text v-if="node.subtitle" class="flow-time">{{ node.subtitle }}</text>
                <text v-if="nodeMeta(node)" class="flow-meta">{{ nodeMeta(node) }}</text>
                <text
                  v-if="node.kind !== 'play' && node.description"
                  class="flow-desc"
                >{{ node.description }}</text>
                <text
                  v-else-if="node.kind === 'play' && node.spot && !isPoiExpanded(node.spot)"
                  class="flow-desc flow-desc--clamp"
                >{{ poiPreviewDescription(node.spot) }}</text>

                <view
                  v-if="node.kind === 'play' && node.spot && isPoiExpanded(node.spot)"
                  class="flow-poi-trust"
                >
                  <text v-if="poiFullDescription(node.spot)" class="flow-desc">
                    {{ poiFullDescription(node.spot) }}
                  </text>
                  <view v-if="node.spot.checkInPhotoUrls?.length" class="flow-checkin-photos">
                    <text class="flow-checkin-label">{{ t('routes.poiCheckInPhotos') }}</text>
                    <scroll-view scroll-x class="flow-checkin-scroll" :show-scrollbar="false">
                      <image
                        v-for="(url, pi) in node.spot.checkInPhotoUrls"
                        :key="`${url}-${pi}`"
                        class="flow-checkin-thumb"
                        :src="url"
                        mode="aspectFill"
                        @click.stop="previewCheckInPhotos(node.spot!.checkInPhotoUrls!, url)"
                      />
                    </scroll-view>
                  </view>
                  <text class="flow-poi-comment-link" @click.stop="emitPoiCommentFocus(node.spot)">
                    {{ t('routes.poiViewComments') }}
                  </text>
                  <text
                    v-if="node.spot.videoUrl"
                    class="flow-poi-video-link"
                    @click.stop="emitPoiVideoPlay(node.spot)"
                  >
                    {{ t('routes.poiPlayVideo') }}
                  </text>
                  <view
                    v-if="poiExternalLinksForSpot(resolvedActiveDayIndex, node.spot).length"
                    class="flow-external-links"
                  >
                    <text class="flow-external-title">{{ t('routes.externalLinksTitle') }}</text>
                    <text class="flow-external-disclaimer">{{ t('routes.externalLinkDisclaimer') }}</text>
                    <text
                      v-for="link in poiExternalLinksForSpot(resolvedActiveDayIndex, node.spot)"
                      :key="link.id"
                      class="flow-external-link"
                      @click.stop="emit('poi-external-link-open', link.url)"
                    >
                      ↗ {{ link.title }}
                    </text>
                  </view>
                  <text
                    v-if="allowExternalLink && node.spot"
                    class="flow-poi-video-link"
                    @click.stop="emitPoiExternalLinkAdd(node.spot)"
                  >
                    {{ t('routes.addExternalLink') }}
                  </text>
                  <text
                    v-if="allowMediaUpload && node.spot"
                    class="flow-poi-video-link"
                    @click.stop="emitPoiVideoUpload(node.spot)"
                  >
                    {{ t('routes.uploadPoiVideo') }}
                  </text>
                </view>
                <text
                  v-if="node.transit?.bookingUrl"
                  class="flow-booking-link"
                  @click.stop="openBookingUrl(node.transit!.bookingUrl!)"
                >
                  {{ bookingLinkLabel(node.transit) }}
                </text>
                <button
                  v-if="showCheckIn && node.kind === 'play' && node.spot"
                  size="mini"
                  class="btn-checkin"
                  @click="emit('check-in', node.spot)"
                >
                  {{ t('routes.checkInHere') }}
                </button>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { RouteDayPlan, RouteDayAttraction, RouteTransitSegment, RoutePoiExternalLinkInfo } from '@douxing/shared';
import {
  buildRoutePoiKey,
  hasPoiTrustContent,
  resolvePoiDisplayDescription,
} from '@douxing/shared';
import type { RouteFlowNode, RouteFlowNodeKind } from '@/utils/route-day-flow';
import { buildRouteDayFlow } from '@/utils/route-day-flow';
import { useTf } from '@/i18n/useTf';

const props = withDefaults(
  defineProps<{
    days: RouteDayPlan[];
    showTitle?: boolean;
    showCheckIn?: boolean;
    allowMediaUpload?: boolean;
    initialDayIndex?: number;
    activeDayIndex?: number;
    showDayTabs?: boolean;
    poiExternalLinks?: RoutePoiExternalLinkInfo[];
    allowExternalLink?: boolean;
  }>(),
  {
    showTitle: true,
    showCheckIn: false,
    allowMediaUpload: false,
    initialDayIndex: 0,
    activeDayIndex: undefined,
    showDayTabs: true,
    poiExternalLinks: () => [],
    allowExternalLink: false,
  },
);

const emit = defineEmits<{
  'check-in': [spot: RouteDayAttraction];
  'update:activeDayIndex': [index: number];
  'poi-comment-focus': [payload: { dayIndex: number; attractionId?: number; poiName: string }];
  'poi-video-play': [payload: { videoUrl: string; coverUrl?: string | null; title: string }];
  'poi-video-upload': [payload: { dayIndex: number; attractionId?: number; poiName: string }];
  'poi-external-link-open': [url: string];
  'poi-external-link-add': [payload: { dayIndex: number; attractionId?: number; poiName: string }];
}>();

const { t, tf } = useTf();

const internalActiveDayIndex = ref(props.initialDayIndex);
const expandedPoiKey = ref<string | null>(null);

const resolvedActiveDayIndex = computed(() =>
  props.activeDayIndex !== undefined ? props.activeDayIndex : internalActiveDayIndex.value,
);

function setActiveDayIndex(index: number) {
  if (index < 0 || index >= props.days.length) return;
  if (props.activeDayIndex !== undefined) {
    emit('update:activeDayIndex', index);
    return;
  }
  internalActiveDayIndex.value = index;
}

watch(
  () => resolvedActiveDayIndex.value,
  () => {
    expandedPoiKey.value = null;
  },
);

function poiKey(spot: RouteDayAttraction): string {
  return buildRoutePoiKey(resolvedActiveDayIndex.value, spot);
}

function isPoiExpanded(spot: RouteDayAttraction): boolean {
  return expandedPoiKey.value === poiKey(spot);
}

/**
 * 切换 POI 信任链详情展开态。
 *
 * @param spot - 游玩 POI
 */
function togglePoiExpand(spot: RouteDayAttraction) {
  const key = poiKey(spot);
  expandedPoiKey.value = expandedPoiKey.value === key ? null : key;
}

/**
 * @param spot - 游玩 POI
 * @returns 折叠态一行预览说明
 */
function poiPreviewDescription(spot: RouteDayAttraction): string {
  const full = resolvePoiDisplayDescription(spot.description, spot.catalogDescription);
  if (full.length <= 72) return full;
  return `${full.slice(0, 72)}…`;
}

/**
 * @param spot - 游玩 POI
 * @returns 展开态完整说明
 */
function poiFullDescription(spot: RouteDayAttraction): string {
  return resolvePoiDisplayDescription(spot.description, spot.catalogDescription);
}

/**
 * @param spot - 游玩 POI
 * @returns 展开/收起提示文案
 */
function poiExpandHint(spot: RouteDayAttraction): string {
  if (!hasPoiTrustContent(spot)) return '';
  return isPoiExpanded(spot) ? t('routes.poiCollapse') : t('routes.poiExpand');
}

/**
 * 预览他人打卡实拍图。
 *
 * @param urls - 缩略图列表
 * @param current - 当前点击图片
 */
function previewCheckInPhotos(urls: string[], current: string) {
  if (!urls.length) return;
  uni.previewImage({ urls, current });
}

/**
 * 通知父级上传 POI 绑定短视频。
 *
 * @param spot - 游玩 POI
 */
function emitPoiVideoUpload(spot: RouteDayAttraction) {
  emit('poi-video-upload', {
    dayIndex: resolvedActiveDayIndex.value,
    attractionId: spot.attractionId,
    poiName: spot.name,
  });
}

/**
 * 通知父级播放 POI 绑定短视频。
 *
 * @param spot - 游玩 POI
 */
function emitPoiVideoPlay(spot: RouteDayAttraction) {
  if (!spot.videoUrl?.trim()) return;
  emit('poi-video-play', {
    videoUrl: spot.videoUrl,
    coverUrl: spot.videoCoverUrl,
    title: spot.name,
  });
}

/**
 * 筛选某 POI 下的站外讨论链接。
 *
 * @param dayIndex - 行程天索引
 * @param spot - POI 节点
 * @returns 匹配的外链列表
 */
function poiExternalLinksForSpot(dayIndex: number, spot: RouteDayAttraction) {
  return (props.poiExternalLinks ?? []).filter((link) => {
    if (link.dayIndex != null && link.dayIndex !== dayIndex) return false;
    if (link.attractionId != null && spot.attractionId != null) {
      return link.attractionId === spot.attractionId;
    }
    return link.poiName?.trim() === spot.name.trim();
  });
}

/**
 * 通知父级打开外链提交表单。
 *
 * @param spot - 游玩 POI
 */
function emitPoiExternalLinkAdd(spot: RouteDayAttraction) {
  emit('poi-external-link-add', {
    dayIndex: resolvedActiveDayIndex.value,
    attractionId: spot.attractionId,
    poiName: spot.name,
  });
}

/**
 * 通知父级聚焦该 POI 相关评论。
 *
 * @param spot - 游玩 POI
 */
function emitPoiCommentFocus(spot: RouteDayAttraction) {
  emit('poi-comment-focus', {
    dayIndex: resolvedActiveDayIndex.value,
    attractionId: spot.attractionId,
    poiName: spot.name,
  });
}

watch(
  () => props.days.length,
  () => {
    if (resolvedActiveDayIndex.value >= props.days.length) {
      setActiveDayIndex(0);
    }
  },
);

const activeDay = computed(() => props.days[resolvedActiveDayIndex.value]);

const flowNodes = computed((): RouteFlowNode[] => {
  if (!activeDay.value) return [];
  return buildRouteDayFlow(activeDay.value);
});

const activeWarnings = computed(() => activeDay.value?.warnings ?? []);

const coverPreviewUrls = computed((): string[] =>
  flowNodes.value
    .filter((node) => node.kind === 'play' && node.spot?.coverImageUrl)
    .map((node) => node.spot!.coverImageUrl!),
);

function previewCoverImage(url: string) {
  if (!url) return;
  const urls = coverPreviewUrls.value.length > 0 ? coverPreviewUrls.value : [url];
  uni.previewImage({ urls, current: url });
}

function dayTabLabel(day: RouteDayPlan, index: number): string {
  if (day.date?.trim()) return day.date;
  return tf('routes.flowDayTab', { day: index + 1 });
}

function dayHeading(day: RouteDayPlan): string {
  if (day.date && day.title) return tf('routes.dayTitle', { date: day.date, title: day.title });
  return day.title || day.date || '';
}

function kindLabel(kind: RouteFlowNodeKind): string {
  if (kind === 'transit') return t('routes.sectionTransit');
  if (kind === 'play') return t('routes.sectionPlay');
  return t('routes.sectionLodging');
}

function nodeMeta(node: RouteFlowNode): string {
  if (node.kind === 'transit' && node.transit) {
    const modeKey = `routes.transitMode_${node.transit.mode}` as const;
    const modeLabel = t(modeKey);
    const mode = modeLabel === modeKey ? node.transit.mode : modeLabel;
    const duration = tf('routes.transitDuration', { minutes: node.transit.durationMinutes });
    if (node.transit.scheduleNo) {
      const schedule = tf('routes.transitScheduleNo', { no: node.transit.scheduleNo });
      return `${schedule} · ${mode} · ${duration}`;
    }
    return `${mode} · ${duration}`;
  }
  if (node.meta != null && node.meta !== '') {
    return `¥${node.meta}`;
  }
  return '';
}

function bookingLinkLabel(seg: RouteTransitSegment): string {
  if (seg.scheduleSource === 'catalog' || seg.scheduleSource === 'api') {
    return t('routes.transitBookReal');
  }
  return t('routes.transitBookDemo');
}

function openBookingUrl(url: string) {
  if (!url) return;
  // #ifdef H5
  window.open(url, '_blank', 'noopener,noreferrer');
  // #endif
  // #ifndef H5
  uni.setClipboardData({
    data: url,
    success: () => {
      uni.showToast({ title: t('routes.bookingLinkCopied'), icon: 'none' });
    },
  });
  // #endif
}
</script>

<style scoped>
.flow-chart {
  width: 100%;
}

.flow-chart-header {
  margin-bottom: 20rpx;
}

.flow-chart-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1f2937;
}

.day-tabs {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
  margin-bottom: 20rpx;
}

.day-tab {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  margin-right: 16rpx;
  border-radius: 999rpx;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 24rpx;
}

.day-tab.active {
  background: var(--dx-primary-light);
  color: var(--dx-primary);
  font-weight: 600;
}

.flow-day-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 20rpx;
}

.flow-empty {
  padding: 24rpx 0;
  color: #9ca3af;
  font-size: 24rpx;
}

.flow-warnings {
  margin-bottom: 20rpx;
  padding: 16rpx 20rpx;
  background: #fffbeb;
  border-radius: 12rpx;
  border: 1rpx solid #fde68a;
}

.flow-warnings-title {
  display: block;
  font-size: 24rpx;
  font-weight: 600;
  color: #b45309;
  margin-bottom: 8rpx;
}

.flow-warning-item {
  display: block;
  font-size: 22rpx;
  color: #d97706;
  line-height: 1.5;
  margin-top: 4rpx;
}

.flow-track {
  display: flex;
  flex-direction: column;
}

.flow-step {
  display: flex;
  flex-direction: row;
  align-items: stretch;
}

.flow-rail {
  width: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.flow-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-top: 18rpx;
  flex-shrink: 0;
}

.flow-dot--transit {
  background: var(--dx-primary);
  box-shadow: 0 0 0 6rpx var(--dx-primary-light);
}

.flow-dot--play {
  background: #10b981;
  box-shadow: 0 0 0 6rpx rgba(16, 185, 129, 0.15);
}

.flow-dot--lodging {
  background: #8b5cf6;
  box-shadow: 0 0 0 6rpx rgba(139, 92, 246, 0.15);
}

.flow-line {
  flex: 1;
  width: 4rpx;
  min-height: 24rpx;
  background: linear-gradient(180deg, #d1d5db 0%, #e5e7eb 100%);
  margin: 8rpx 0;
}

.flow-card {
  flex: 1;
  margin-bottom: 24rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  border-left: 6rpx solid #d1d5db;
  background: #fafafa;
}

.flow-card--transit {
  border-left-color: var(--dx-primary);
  background: var(--dx-primary-light);
}

.flow-card--play {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.flow-card--lodging {
  border-left-color: #8b5cf6;
  background: #faf5ff;
}

.flow-card-head {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
}

.flow-card-body {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
  align-items: flex-start;
}

.flow-thumb-wrap {
  flex-shrink: 0;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
}

.flow-thumb--placeholder {
  background: #1f2937;
}

.flow-video-badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.28);
}

.flow-video-icon {
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
}

.flow-thumb-wrap:active {
  opacity: 0.85;
}

.flow-thumb {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  display: block;
  background: #e5e7eb;
}

.flow-card-main {
  flex: 1;
  min-width: 0;
}

.flow-kind {
  font-size: 22rpx;
  font-weight: 600;
  color: #374151;
  letter-spacing: 1rpx;
}

.flow-badge {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  background: #e5e7eb;
  color: #6b7280;
}

.flow-badge--warn {
  background: #fef3c7;
  color: #d97706;
}

.flow-title {
  display: block;
  font-size: 28rpx;
  font-weight: 600;
  color: #111827;
  line-height: 1.4;
}

.flow-time {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #6b7280;
}

.flow-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
}

.flow-desc {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: #4b5563;
  line-height: 1.5;
}

.flow-booking-link {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
  text-decoration: underline;
}

.btn-checkin {
  margin-top: 12rpx;
  background: var(--dx-primary-light);
  color: var(--dx-primary);
}

.flow-title-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.flow-expand-hint {
  flex-shrink: 0;
  font-size: 22rpx;
  color: var(--dx-primary);
}

.flow-desc--clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.flow-poi-trust {
  margin-top: 12rpx;
  padding-top: 12rpx;
  border-top: 1rpx dashed #d1d5db;
}

.flow-checkin-photos {
  margin-top: 12rpx;
}

.flow-checkin-label {
  display: block;
  font-size: 22rpx;
  color: #6b7280;
  margin-bottom: 8rpx;
}

.flow-checkin-scroll {
  display: flex;
  flex-direction: row;
  white-space: nowrap;
}

.flow-checkin-thumb {
  width: 96rpx;
  height: 96rpx;
  border-radius: 12rpx;
  margin-right: 12rpx;
  background: #e5e7eb;
  flex-shrink: 0;
}

.flow-poi-comment-link {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
}

.flow-poi-video-link {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
}

.flow-external-links {
  margin-top: 16rpx;
}

.flow-external-title {
  display: block;
  font-size: 22rpx;
  color: #9ca3af;
  margin-bottom: 4rpx;
}

.flow-external-disclaimer {
  display: block;
  font-size: 20rpx;
  color: #9ca3af;
  margin-bottom: 8rpx;
}

.flow-external-link {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--dx-primary);
}
</style>
