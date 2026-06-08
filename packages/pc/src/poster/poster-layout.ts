import type {
  PosterCanvasContext,
  PosterDayBlock,
  PosterPayload,
  PosterPoiItem,
  PosterTemplateId,
} from './types';
import {
  DIARY_ITEM_TITLE_STYLE,
  TIMELINE_ITEM_TITLE_STYLE,
  estimateItemTitleRowHeight,
  measureItemTitleRowHeight,
} from './draw-kind-badge';
import { getDiaryPhotoStripHeight, getTimelinePhotoStripHeight } from './draw-poster-images';
import { POSTER_HEIGHT, POSTER_WIDTH, WRAP_LINES_UNLIMITED, getWrapTextHeight } from './draw-utils';

export { kindLabel } from './draw-kind-badge';

export const FOOTER_RESERVE = 200;
/** 微信小程序 canvas 高度上限约 4096px */
const MAX_POSTER_HEIGHT = 4096;

const DIARY_HEADER_GAP = 20;
const DIARY_BLOCK_GAP = 20;
const DIARY_CARD_PAD_BOTTOM = 20;
const TIMELINE_HEADER_BASE = 220;
const TIMELINE_FOOTER_GAP = 188;

function diaryTextMaxWidth(width: number): number {
  return width - 80 - 32;
}

/** 无 canvas 时按字号估算行数 */
function estimateWrapLines(text: string, maxWidth: number, fontSize: number): number {
  if (!text) return 0;
  let lineWidth = 0;
  let lines = 1;
  for (const ch of text) {
    const charW = /[\u0000-\u007f]/.test(ch) ? fontSize * 0.55 : fontSize;
    if (lineWidth + charW > maxWidth && lineWidth > 0) {
      lines += 1;
      lineWidth = charW;
    } else {
      lineWidth += charW;
    }
  }
  return lines;
}

export function estimateDiaryHeaderHeight(payload: PosterPayload, width = POSTER_WIDTH): number {
  const innerW = width - 96;
  let h = 56 + Math.min(2, estimateWrapLines(payload.title, innerW, 38)) * 44;
  h += 36;
  if (payload.subtitle?.trim()) {
    h += estimateWrapLines(payload.subtitle, innerW, 20) * 28;
  }
  return h + 28;
}

export function measureDiaryHeaderHeight(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  width = POSTER_WIDTH,
): number {
  const innerW = width - 96;
  let y = 88;
  ctx.font = 'bold 38px sans-serif';
  y += getWrapTextHeight(ctx, payload.title, innerW, 44, 2);
  y += 36;
  if (payload.subtitle?.trim()) {
    ctx.font = '20px sans-serif';
    y += getWrapTextHeight(ctx, payload.subtitle, innerW, 28, WRAP_LINES_UNLIMITED);
  }
  return y - 32 + 28;
}

function estimateDiaryItemHeight(
  item: PosterPoiItem,
  textMaxW: number,
  labels: PosterPayload['labels'],
): number {
  let h = estimateItemTitleRowHeight(item.kind, item.name, labels, textMaxW, DIARY_ITEM_TITLE_STYLE);
  if (item.time || item.meta) h += 20;
  if (item.desc) {
    h += estimateWrapLines(item.desc, textMaxW, 16) * 20 + 6;
  }
  h += 10;
  return h;
}

export function estimateDiaryDayBlockHeight(
  day: PosterDayBlock,
  labels: PosterPayload['labels'],
  width = POSTER_WIDTH,
): number {
  const textMaxW = diaryTextMaxWidth(width);
  const labelH = Math.min(2, estimateWrapLines(day.label, textMaxW, 24)) * 28;
  const photoStripH = getDiaryPhotoStripHeight(day.highlightImages.length);
  let contentH = 36 + labelH + 14;
  if (photoStripH > 0) {
    contentH += photoStripH + 12;
  } else {
    contentH += 8;
  }
  for (const item of day.items) {
    contentH += estimateDiaryItemHeight(item, textMaxW, labels);
  }
  let blockH = Math.max(56, contentH) + DIARY_CARD_PAD_BOTTOM;
  if (day.hiddenItemCount > 0) blockH += 24;
  return blockH;
}

function estimateTimelineItemHeight(
  item: PosterPoiItem,
  colInnerW: number,
  labels: PosterPayload['labels'],
): number {
  let h = estimateItemTitleRowHeight(
    item.kind,
    item.name,
    labels,
    colInnerW,
    TIMELINE_ITEM_TITLE_STYLE,
  );
  const sub = [item.time, item.meta].filter(Boolean).join(' · ');
  if (sub) h += estimateWrapLines(sub, colInnerW, 17) * 22;
  if (item.desc) {
    h += estimateWrapLines(item.desc, colInnerW, 16) * 20 + 2;
  }
  h += 10;
  return h;
}

export function measureTimelineHeaderHeight(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  width = POSTER_WIDTH,
): number {
  const innerW = width - 104;
  let y = 96;
  ctx.font = 'bold 40px sans-serif';
  y += getWrapTextHeight(ctx, payload.title, innerW, 46, 2);
  y += 40;
  if (payload.subtitle?.trim()) {
    ctx.font = '22px sans-serif';
    y += getWrapTextHeight(ctx, payload.subtitle, innerW, 30, WRAP_LINES_UNLIMITED);
  }
  return Math.max(TIMELINE_HEADER_BASE, y - 36 + 24);
}

function estimateTimelineHeaderHeight(payload: PosterPayload, width = POSTER_WIDTH): number {
  const innerW = width - 104;
  let h = 60 + Math.min(2, estimateWrapLines(payload.title, innerW, 40)) * 46;
  h += 40;
  if (payload.subtitle?.trim()) {
    h += estimateWrapLines(payload.subtitle, innerW, 22) * 30;
  }
  return Math.max(TIMELINE_HEADER_BASE, h + 24);
}

function estimateTimelineDayLabelBarHeight(label: string, colInnerW: number): number {
  const lines = estimateWrapLines(label, colInnerW, 22);
  return Math.max(52, lines * 26 + 24);
}

function estimateTimelineColumnHeight(
  day: PosterDayBlock,
  colInnerW: number,
  labels: PosterPayload['labels'],
): number {
  let h = estimateTimelineDayLabelBarHeight(day.label, colInnerW) + 8;
  h += getTimelinePhotoStripHeight(day.highlightImages.length);
  for (const item of day.items) {
    h += estimateTimelineItemHeight(item, colInnerW, labels);
  }
  if (day.hiddenItemCount > 0) h += 28;
  return h;
}

export function measureDiaryDayBlockHeight(
  ctx: PosterCanvasContext,
  day: PosterDayBlock,
  labels: PosterPayload['labels'],
  width = POSTER_WIDTH,
): number {
  const textMaxW = diaryTextMaxWidth(width);
  ctx.font = 'bold 24px sans-serif';
  const labelH = getWrapTextHeight(ctx, day.label, textMaxW, 28, 2);
  const photoStripH = getDiaryPhotoStripHeight(day.highlightImages.length);
  let textY = 36 + labelH + 14;
  if (photoStripH > 0) {
    textY += photoStripH + 12;
  } else {
    textY += 8;
  }

  for (const item of day.items) {
    textY += measureItemTitleRowHeight(
      ctx,
      item.kind,
      item.name,
      labels,
      textMaxW,
      DIARY_ITEM_TITLE_STYLE,
    );
    if (item.time || item.meta) textY += 20;
    if (item.desc) {
      ctx.font = '16px sans-serif';
      textY += getWrapTextHeight(ctx, item.desc, textMaxW, 20, WRAP_LINES_UNLIMITED) + 4;
    }
    textY += 14;
  }

  let blockH = Math.max(56, textY) + DIARY_CARD_PAD_BOTTOM;
  if (day.hiddenItemCount > 0) blockH += 24;
  return blockH;
}

function measureTimelineDayLabelBarHeight(
  ctx: PosterCanvasContext,
  label: string,
  colInnerW: number,
): number {
  ctx.font = 'bold 22px sans-serif';
  const textH = getWrapTextHeight(ctx, label, colInnerW, 26, WRAP_LINES_UNLIMITED);
  return Math.max(52, textH + 24);
}

function measureTimelineItemHeight(
  ctx: PosterCanvasContext,
  item: PosterPoiItem,
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
  const subParts = [item.time, item.meta].filter(Boolean).join(' · ');
  if (subParts) {
    ctx.font = '17px sans-serif';
    h += getWrapTextHeight(ctx, subParts, colInnerW, 20, 1);
  }
  if (item.desc) {
    ctx.font = '16px sans-serif';
    h += getWrapTextHeight(ctx, item.desc, colInnerW, 20, WRAP_LINES_UNLIMITED) + 2;
  }
  h += 14;
  return h;
}

function measureTimelineColumnHeight(
  ctx: PosterCanvasContext,
  day: PosterDayBlock,
  colInnerW: number,
  labels: PosterPayload['labels'],
): number {
  let h = measureTimelineDayLabelBarHeight(ctx, day.label, colInnerW) + 8;
  const photoStripH = getTimelinePhotoStripHeight(day.highlightImages.length);
  h += photoStripH;
  if (photoStripH > 0) h += 8;
  for (const item of day.items) {
    h += measureTimelineItemHeight(ctx, item, colInnerW, labels);
  }
  if (day.hiddenItemCount > 0) h += 28;
  return h;
}

function clampPosterHeight(height: number): number {
  return Math.min(MAX_POSTER_HEIGHT, Math.max(POSTER_HEIGHT, height));
}

/** 用 canvas 实测各区块高度，保证日记页多天内容不被裁切 */
export function measurePosterHeight(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  templateId: PosterTemplateId,
): number {
  const moreDays = payload.hiddenDayCount > 0 ? 40 : 0;

  if (templateId === 'timeline-columns') {
    const headerH = measureTimelineHeaderHeight(ctx, payload);
    const dayCount = Math.max(payload.days.length, 1);
    const gap = 16;
    const colW = (POSTER_WIDTH - 56 - gap * (dayCount - 1)) / dayCount;
    const colInnerW = colW - 24;
    let maxCol = 0;
    for (const day of payload.days) {
      maxCol = Math.max(maxCol, measureTimelineColumnHeight(ctx, day, colInnerW, payload.labels));
    }
    return clampPosterHeight(headerH + 60 + maxCol + TIMELINE_FOOTER_GAP + moreDays);
  }

  const headerH = measureDiaryHeaderHeight(ctx, payload);
  let body = 0;
  for (const day of payload.days) {
    body += measureDiaryDayBlockHeight(ctx, day, payload.labels) + DIARY_BLOCK_GAP;
  }
  if (body > 0) body -= DIARY_BLOCK_GAP;
  return clampPosterHeight(32 + headerH + DIARY_HEADER_GAP + body + FOOTER_RESERVE + moreDays);
}

/** 按模板与 payload 估算画布高度（无 canvas 时的回退值） */
export function computePosterHeight(
  payload: PosterPayload,
  templateId: PosterTemplateId,
): number {
  if (templateId === 'timeline-columns') {
    const headerH = estimateTimelineHeaderHeight(payload);
    const dayCount = Math.max(payload.days.length, 1);
    const gap = 16;
    const colW = (POSTER_WIDTH - 56 - gap * (dayCount - 1)) / dayCount;
    const colInnerW = colW - 24;
    let maxCol = 0;
    for (const day of payload.days) {
      maxCol = Math.max(maxCol, estimateTimelineColumnHeight(day, colInnerW, payload.labels));
    }
    const moreDays = payload.hiddenDayCount > 0 ? 40 : 0;
    return Math.min(
      MAX_POSTER_HEIGHT,
      Math.max(POSTER_HEIGHT, headerH + 60 + maxCol + TIMELINE_FOOTER_GAP + moreDays),
    );
  }

  const headerH = estimateDiaryHeaderHeight(payload);
  let body = 0;
  for (const day of payload.days) {
    body += estimateDiaryDayBlockHeight(day, payload.labels) + DIARY_BLOCK_GAP;
  }
  if (body > 0) body -= DIARY_BLOCK_GAP;
  const moreDays = payload.hiddenDayCount > 0 ? 40 : 0;
  return Math.min(
    MAX_POSTER_HEIGHT,
    Math.max(
      POSTER_HEIGHT,
      32 + headerH + DIARY_HEADER_GAP + body + FOOTER_RESERVE + moreDays,
    ),
  );
}

