import type {
  PosterCanvasContext,
  PosterPayload,
  PosterRenderResult,
} from '../types';
import type { PosterImageMap } from '../load-poster-image';
import { drawDiaryPhotoStrip } from '../draw-poster-images';
import { DIARY_ITEM_TITLE_STYLE, drawItemTitleRow } from '../draw-kind-badge';
import { FOOTER_RESERVE, measureDiaryDayBlockHeight, measureDiaryHeaderHeight } from '../poster-layout';
import {
  POSTER_COLORS,
  POSTER_WIDTH,
  WRAP_LINES_UNLIMITED,
  drawBrandFooter,
  fillPaperBackground,
  roundRect,
  wrapText,
} from '../draw-utils';
import { drawQrCode, drawQrPlaceholder } from '../draw-qr-code';

const DIARY_CARD_PAD_BOTTOM = 20;

function drawTape(ctx: PosterCanvasContext, x: number, y: number, w: number) {
  ctx.save();
  ctx.fillStyle = POSTER_COLORS.tape;
  ctx.translate(x + w / 2, y);
  ctx.rotate(-0.08);
  ctx.fillRect(-w / 2, -10, w, 20);
  ctx.restore();
}

function diaryTextMaxWidth(width: number): number {
  return width - 80 - 32;
}

function drawDiaryHeader(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  width: number,
): number {
  const headerH = measureDiaryHeaderHeight(ctx, payload, width);
  const innerW = width - 96;

  ctx.fillStyle = POSTER_COLORS.card;
  roundRect(ctx, 24, 32, width - 48, headerH, 18);
  ctx.fill();

  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = 'bold 38px sans-serif';
  let y = wrapText(ctx, payload.title, 48, 88, innerW, 44, 2);

  ctx.fillStyle = POSTER_COLORS.inkMuted;
  ctx.font = '22px sans-serif';
  ctx.fillText(`${payload.city} · ${payload.labels.dayCount}`, 48, y + 8);
  y += 36;

  if (payload.subtitle?.trim()) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = POSTER_COLORS.inkMuted;
    y = wrapText(ctx, payload.subtitle, 48, y, innerW, 28, WRAP_LINES_UNLIMITED);
  }

  return headerH;
}

export function renderDiaryPagePoster(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  imageMap?: PosterImageMap,
  canvasHeight = 1334,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = canvasHeight;
  fillPaperBackground(ctx, width, height);

  const headerH = drawDiaryHeader(ctx, payload, width);
  let cursorY = 32 + headerH + 20;
  const blockGap = 20;
  const cardW = width - 80;
  const textMaxW = diaryTextMaxWidth(width);

  for (const day of payload.days) {
    const blockH = measureDiaryDayBlockHeight(ctx, day, payload.labels, width);

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 40, cursorY, cardW, blockH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(44,36,22,0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, 40, cursorY, cardW, blockH, 16);
    ctx.stroke();

    drawTape(ctx, 56, cursorY - 6, 72);

    ctx.fillStyle = day.themeColor;
    ctx.font = 'bold 24px sans-serif';
    const labelEndY = wrapText(ctx, day.label, 56, cursorY + 36, textMaxW, 28, 2);

    let textY = labelEndY + 14;
    let photoStripH = 0;
    if (day.highlightImages.length > 0) {
      photoStripH = drawDiaryPhotoStrip(
        ctx,
        day.highlightImages,
        imageMap,
        40,
        textY,
        cardW,
      );
      textY += photoStripH + 12;
    } else {
      textY += 8;
    }

    for (const item of day.items) {
      textY = drawItemTitleRow(
        ctx,
        item.kind,
        item.name,
        payload.labels,
        56,
        textY,
        textMaxW,
        DIARY_ITEM_TITLE_STYLE,
      );

      const sub: string[] = [];
      if (item.time) sub.push(item.time);
      if (item.meta) sub.push(item.meta);
      if (sub.length) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '16px sans-serif';
        ctx.fillText(sub.join(' · '), 56, textY);
        textY += 20;
      }

      if (item.desc) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '16px sans-serif';
        textY = wrapText(ctx, item.desc, 56, textY + 4, textMaxW, 20, WRAP_LINES_UNLIMITED);
      }

      textY += 14;
    }

    if (day.hiddenItemCount > 0) {
      ctx.fillStyle = POSTER_COLORS.inkMuted;
      ctx.font = '16px sans-serif';
      ctx.fillText(
        payload.labels.moreItems.replace('{count}', String(day.hiddenItemCount)),
        56,
        cursorY + blockH - DIARY_CARD_PAD_BOTTOM - 4,
      );
    }

    cursorY += blockH + blockGap;
  }

  if (payload.hiddenDayCount > 0) {
    ctx.fillStyle = POSTER_COLORS.inkMuted;
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      payload.labels.moreDays.replace('{count}', String(payload.hiddenDayCount)),
      width / 2,
      height - FOOTER_RESERVE + 24,
    );
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
