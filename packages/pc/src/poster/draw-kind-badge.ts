import type { PosterCanvasContext, PosterPayload, PosterPoiKind } from './types';
import { POSTER_COLORS, getWrapTextHeight, roundRect, wrapText } from './draw-utils';

export function kindLabel(
  kind: PosterPoiKind,
  labels: PosterPayload['labels'],
): string {
  if (kind === 'transit') return labels.sectionTransit;
  if (kind === 'lodging') return labels.sectionLodging;
  return labels.sectionPlay;
}

const KIND_COLORS: Record<PosterPoiKind, string> = {
  transit: '#2563eb',
  play: '#059669',
  lodging: '#7c3aed',
};

export interface ItemTitleRowStyle {
  badgeFontSize: number;
  badgePadX: number;
  badgeGap: number;
  badgeBoxH: number;
  badgeRadius: number;
  titleFont: string;
  titleLineHeight: number;
  titleMaxLines: number;
}

export const DIARY_ITEM_TITLE_STYLE: ItemTitleRowStyle = {
  badgeFontSize: 15,
  badgePadX: 6,
  badgeGap: 8,
  badgeBoxH: 20,
  badgeRadius: 5,
  titleFont: 'bold 20px sans-serif',
  titleLineHeight: 26,
  titleMaxLines: 2,
};

export const TIMELINE_ITEM_TITLE_STYLE: ItemTitleRowStyle = {
  badgeFontSize: 16,
  badgePadX: 8,
  badgeGap: 8,
  badgeBoxH: 22,
  badgeRadius: 6,
  titleFont: 'bold 19px sans-serif',
  titleLineHeight: 24,
  titleMaxLines: 2,
};

export function getKindBadgeWidth(
  ctx: PosterCanvasContext,
  kind: PosterPoiKind,
  labels: PosterPayload['labels'],
  style: Pick<ItemTitleRowStyle, 'badgeFontSize' | 'badgePadX'>,
): number {
  const text = kindLabel(kind, labels);
  ctx.font = `${style.badgeFontSize}px sans-serif`;
  return ctx.measureText(text).width + style.badgePadX * 2;
}

export function drawKindBadge(
  ctx: PosterCanvasContext,
  kind: PosterPoiKind,
  x: number,
  baselineY: number,
  labels: PosterPayload['labels'],
  style: Pick<ItemTitleRowStyle, 'badgeFontSize' | 'badgePadX' | 'badgeBoxH' | 'badgeRadius'>,
): number {
  const text = kindLabel(kind, labels);
  ctx.font = `${style.badgeFontSize}px sans-serif`;
  const w = ctx.measureText(text).width + style.badgePadX * 2;
  const boxTop = baselineY - style.badgeBoxH + 6;
  ctx.fillStyle = KIND_COLORS[kind];
  roundRect(ctx, x, boxTop, w, style.badgeBoxH, style.badgeRadius);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x + style.badgePadX, baselineY);
  return w;
}

/** 估算标签宽度（无 canvas） */
export function estimateKindBadgeWidth(
  kind: PosterPoiKind,
  labels: PosterPayload['labels'],
  fontSize: number,
  padX: number,
): number {
  const text = kindLabel(kind, labels);
  return text.length * fontSize + padX * 2;
}

export function measureItemTitleRowHeight(
  ctx: PosterCanvasContext,
  kind: PosterPoiKind,
  name: string,
  labels: PosterPayload['labels'],
  maxW: number,
  style: ItemTitleRowStyle,
): number {
  const badgeW = getKindBadgeWidth(ctx, kind, labels, style);
  const titleMaxW = Math.max(40, maxW - badgeW - style.badgeGap);
  ctx.font = style.titleFont;
  const titleH = getWrapTextHeight(ctx, name, titleMaxW, style.titleLineHeight, style.titleMaxLines);
  // 与 drawItemTitleRow + wrapText 一致：baseline 偏移 + 文本高度
  return style.titleLineHeight - 6 + titleH;
}

/** 标签 + 标题同一行（标题在标签右侧换行） */
export function drawItemTitleRow(
  ctx: PosterCanvasContext,
  kind: PosterPoiKind,
  name: string,
  labels: PosterPayload['labels'],
  x: number,
  y: number,
  maxW: number,
  style: ItemTitleRowStyle,
): number {
  const baselineY = y + style.titleLineHeight - 6;
  drawKindBadge(ctx, kind, x, baselineY, labels, style);
  const badgeW = getKindBadgeWidth(ctx, kind, labels, style);
  const titleX = x + badgeW + style.badgeGap;
  const titleMaxW = Math.max(40, maxW - badgeW - style.badgeGap);
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = style.titleFont;
  return wrapText(ctx, name, titleX, baselineY, titleMaxW, style.titleLineHeight, style.titleMaxLines);
}

export function estimateItemTitleRowHeight(
  kind: PosterPoiKind,
  name: string,
  labels: PosterPayload['labels'],
  maxW: number,
  style: ItemTitleRowStyle,
): number {
  const badgeW = estimateKindBadgeWidth(kind, labels, style.badgeFontSize, style.badgePadX);
  const titleMaxW = Math.max(40, maxW - badgeW - style.badgeGap);
  let lineWidth = 0;
  let lines = 1;
  for (const ch of name) {
    const charW = /[\u0000-\u007f]/.test(ch) ? style.badgeFontSize * 0.55 : style.badgeFontSize;
    if (lineWidth + charW > titleMaxW && lineWidth > 0) {
      lines += 1;
      if (lines >= style.titleMaxLines) break;
      lineWidth = charW;
    } else {
      lineWidth += charW;
    }
  }
  const titleH = Math.min(lines, style.titleMaxLines) * style.titleLineHeight;
  return Math.max(style.badgeBoxH, titleH) + 8;
}
