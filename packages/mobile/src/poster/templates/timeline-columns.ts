import type {
  PosterCanvasContext,
  PosterDayBlock,
  PosterPayload,
  PosterRenderResult,
} from '../types';
import type { PosterImageMap } from '../load-poster-image';
import { drawTimelinePhotoStrip } from '../draw-poster-images';
import {
  TIMELINE_ITEM_TITLE_STYLE,
  drawItemTitleRow,
  measureItemTitleRowHeight,
} from '../draw-kind-badge';
import { measureTimelineHeaderHeight } from '../poster-layout';
import {
  POSTER_COLORS,
  POSTER_WIDTH,
  WRAP_LINES_UNLIMITED,
  drawBrandFooter,
  fillPaperBackground,
  getWrapTextHeight,
  roundRect,
  wrapText,
} from '../draw-utils';
import { drawQrCode, drawQrPlaceholder } from '../draw-qr-code';

function formatMoreDays(payload: PosterPayload): string | null {
  if (payload.hiddenDayCount <= 0) return null;
  return payload.labels.moreDays.replace('{count}', String(payload.hiddenDayCount));
}

function measureTimelineItemHeight(
  ctx: PosterCanvasContext,
  item: PosterDayBlock['items'][number],
  colInnerW: number,
  labels: PosterPayload['labels'],
): number {
  let h = measureItemTitleRowHeight(
    ctx,
    item.kind,
    item.name,
    labels,
    colInnerW,
    TIMELINE_ITEM_TITLE_STYLE,
  );
  const subParts: string[] = [];
  if (item.time) subParts.push(item.time);
  if (item.meta) subParts.push(item.meta);
  if (subParts.length) {
    ctx.font = '17px sans-serif';
    h += getWrapTextHeight(ctx, subParts.join(' · '), colInnerW, 20, 1);
  }
  if (item.desc) {
    ctx.font = '16px sans-serif';
    h += getWrapTextHeight(ctx, item.desc, colInnerW, 20, WRAP_LINES_UNLIMITED) + 2;
  }
  h += 14;
  return h;
}

const TIMELINE_LABEL_PAD = 24;
const TIMELINE_LABEL_MIN_BAR = 52;

function measureTimelineDayLabelBarHeight(
  ctx: PosterCanvasContext,
  label: string,
  colInnerW: number,
): number {
  ctx.font = 'bold 22px sans-serif';
  const textH = getWrapTextHeight(ctx, label, colInnerW, 26, WRAP_LINES_UNLIMITED);
  return Math.max(TIMELINE_LABEL_MIN_BAR, textH + TIMELINE_LABEL_PAD);
}

export function renderTimelineColumnsPoster(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  imageMap?: PosterImageMap,
  canvasHeight = 1334,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = canvasHeight;
  fillPaperBackground(ctx, width, height);

  const headerH = measureTimelineHeaderHeight(ctx, payload, width);
  const innerW = width - 104;
  ctx.fillStyle = POSTER_COLORS.accent;
  roundRect(ctx, 28, 36, width - 56, headerH, 20);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  let headerY = wrapText(ctx, payload.title, 52, 96, innerW, 46, 2);
  ctx.font = '24px sans-serif';
  ctx.globalAlpha = 0.92;
  const meta = `${payload.city} · ${payload.labels.dayCount}`;
  ctx.fillText(meta, 52, headerY + 8);
  ctx.globalAlpha = 1;
  headerY += 40;
  if (payload.subtitle?.trim()) {
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '22px sans-serif';
    headerY = wrapText(ctx, payload.subtitle, 52, headerY, innerW, 30, WRAP_LINES_UNLIMITED);
  }

  const colTop = 36 + headerH + 24;
  const footerGap = 188;
  const colBottom = height - footerGap;
  const gap = 16;
  const dayCount = payload.days.length;
  const colW = (width - 56 - gap * (dayCount - 1)) / Math.max(dayCount, 1);
  const colInnerW = colW - 24;

  const colAreaH = colBottom - colTop;
  payload.days.forEach((day, index) => {
    const x = 28 + index * (colW + gap);
    const labelBarH = measureTimelineDayLabelBarHeight(ctx, day.label, colInnerW);

    ctx.fillStyle = POSTER_COLORS.columnBg;
    roundRect(ctx, x, colTop, colW, colAreaH, 14);
    ctx.fill();

    ctx.fillStyle = day.themeColor;
    roundRect(ctx, x, colTop, colW, labelBarH, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    wrapText(ctx, day.label, x + 12, colTop + 28, colInnerW, 26, WRAP_LINES_UNLIMITED);

    let contentY = colTop + labelBarH + 8;
    const photoStripH = drawTimelinePhotoStrip(
      ctx,
      day.highlightImages,
      imageMap,
      x,
      contentY,
      colW,
    );

    let itemY = contentY + photoStripH + (photoStripH > 0 ? 8 : 0);
    const itemBottom = colTop + colAreaH - 12;

    day.items.forEach((item) => {
      const itemH = measureTimelineItemHeight(ctx, item, colInnerW, payload.labels);
      if (itemY + itemH > itemBottom) return;

      itemY = drawItemTitleRow(
        ctx,
        item.kind,
        item.name,
        payload.labels,
        x + 12,
        itemY,
        colInnerW,
        TIMELINE_ITEM_TITLE_STYLE,
      );

      const subParts: string[] = [];
      if (item.time) subParts.push(item.time);
      if (item.meta) subParts.push(item.meta);
      if (subParts.length) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '17px sans-serif';
        wrapText(ctx, subParts.join(' · '), x + 12, itemY, colW - 24, 20, 1);
        itemY += 22;
      }

      if (item.desc) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '16px sans-serif';
        itemY = wrapText(ctx, item.desc, x + 12, itemY + 2, colW - 24, 20, WRAP_LINES_UNLIMITED);
      }

      itemY += 14;
    });

    if (day.hiddenItemCount > 0 && itemY < itemBottom) {
      ctx.fillStyle = POSTER_COLORS.inkMuted;
      ctx.font = '16px sans-serif';
      ctx.fillText(
        payload.labels.moreItems.replace('{count}', String(day.hiddenItemCount)),
        x + 12,
        Math.min(itemY + 16, itemBottom - 8),
      );
    }
  });

  const moreDays = formatMoreDays(payload);
  if (moreDays) {
    ctx.fillStyle = POSTER_COLORS.inkMuted;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(moreDays, width / 2, colBottom + 36);
    ctx.textAlign = 'left';
  }

  drawBrandFooter(
    ctx,
    width,
    height,
    payload.brand.name,
    payload.brand.tagline,
    payload.brand.scanHint,
    112,
    (qrX, qrY, qrSize) => {
      if (payload.qrUrl) {
        drawQrCode(ctx, payload.qrUrl, qrX, qrY, qrSize);
      } else {
        drawQrPlaceholder(ctx, qrX, qrY, qrSize);
      }
    },
  );

  return { width, height };
}
