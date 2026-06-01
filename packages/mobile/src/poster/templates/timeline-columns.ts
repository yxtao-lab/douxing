import type { PosterCanvasContext, PosterPayload, PosterRenderResult } from '../types';
import type { PosterImageMap } from '../load-poster-image';
import {
  POSTER_COLORS,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  drawBrandFooter,
  fillPaperBackground,
  roundRect,
  wrapText,
} from '../draw-utils';
import { drawQrCode, drawQrPlaceholder } from '../draw-qr-code';

function formatMoreDays(payload: PosterPayload): string | null {
  if (payload.hiddenDayCount <= 0) return null;
  return payload.labels.moreDays.replace('{count}', String(payload.hiddenDayCount));
}

export function renderTimelineColumnsPoster(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
  _imageMap?: PosterImageMap,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = POSTER_HEIGHT;
  fillPaperBackground(ctx, width, height);

  const headerH = 220;
  ctx.fillStyle = POSTER_COLORS.accent;
  roundRect(ctx, 28, 36, width - 56, headerH, 20);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  wrapText(ctx, payload.title, 52, 96, width - 104, 46, 2);
  ctx.font = '24px sans-serif';
  ctx.globalAlpha = 0.92;
  const meta = `${payload.city} · ${payload.labels.dayCount}`;
  ctx.fillText(meta, 52, 168);
  ctx.globalAlpha = 1;
  if (payload.subtitle) {
    ctx.fillStyle = POSTER_COLORS.inkMuted;
    ctx.font = '22px sans-serif';
    wrapText(ctx, payload.subtitle, 52, 204, width - 104, 30, 2);
  }

  const colTop = 280;
  const colBottom = height - 188;
  const colAreaH = colBottom - colTop;
  const dayCount = payload.days.length;
  const gap = 16;
  const colW = (width - 56 - gap * (dayCount - 1)) / Math.max(dayCount, 1);

  payload.days.forEach((day, index) => {
    const x = 28 + index * (colW + gap);
    ctx.fillStyle = POSTER_COLORS.columnBg;
    roundRect(ctx, x, colTop, colW, colAreaH, 14);
    ctx.fill();

    ctx.fillStyle = day.themeColor;
    roundRect(ctx, x, colTop, colW, 52, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px sans-serif';
    wrapText(ctx, day.label, x + 12, colTop + 34, colW - 24, 26, 2);

    let itemY = colTop + 72;
    day.items.forEach((item) => {
      ctx.fillStyle = POSTER_COLORS.ink;
      ctx.font = 'bold 20px sans-serif';
      itemY = wrapText(ctx, item.name, x + 12, itemY, colW - 24, 26, 2);
      if (item.time) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '18px sans-serif';
        ctx.fillText(item.time, x + 12, itemY);
        itemY += 24;
      }
      if (item.desc) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '18px sans-serif';
        itemY = wrapText(ctx, item.desc, x + 12, itemY + 4, colW - 24, 22, 2);
      }
      itemY += 16;
    });
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
