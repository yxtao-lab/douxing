import type { PosterCanvasContext, PosterPayload, PosterRenderResult } from '../types';
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

function drawTape(ctx: PosterCanvasContext, x: number, y: number, w: number) {
  ctx.save();
  ctx.fillStyle = POSTER_COLORS.tape;
  ctx.translate(x + w / 2, y);
  ctx.rotate(-0.08);
  ctx.fillRect(-w / 2, -10, w, 20);
  ctx.restore();
}

export function renderDiaryPagePoster(
  ctx: PosterCanvasContext,
  payload: PosterPayload,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = POSTER_HEIGHT;
  fillPaperBackground(ctx, width, height);

  ctx.fillStyle = POSTER_COLORS.card;
  roundRect(ctx, 24, 32, width - 48, 180, 18);
  ctx.fill();
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = 'bold 38px sans-serif';
  wrapText(ctx, payload.title, 48, 88, width - 96, 44, 2);
  ctx.fillStyle = POSTER_COLORS.inkMuted;
  ctx.font = '22px sans-serif';
  ctx.fillText(`${payload.city} · ${payload.labels.dayCount}`, 48, 148);
  if (payload.subtitle) {
    ctx.font = '20px sans-serif';
    wrapText(ctx, payload.subtitle, 48, 182, width - 96, 28, 2);
  }

  let cursorY = 240;
  const blockGap = 24;
  const maxBlocks = Math.min(payload.days.length, 4);

  for (let i = 0; i < maxBlocks; i += 1) {
    const day = payload.days[i]!;
    const blockH = 200;
    if (cursorY + blockH > height - 200) break;

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 40, cursorY, width - 80, blockH, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(44,36,22,0.08)';
    ctx.lineWidth = 2;
    roundRect(ctx, 40, cursorY, width - 80, blockH, 16);
    ctx.stroke();

    drawTape(ctx, 56, cursorY - 6, 72);

    ctx.fillStyle = day.themeColor;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(day.label, 56, cursorY + 40);

    const polaroidW = 148;
    const polaroidH = 118;
    const polaroidX = width - 80 - polaroidW - 16;
    const polaroidY = cursorY + 52;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(polaroidX, polaroidY, polaroidW, polaroidH);
    ctx.strokeStyle = '#e5e7eb';
    ctx.strokeRect(polaroidX, polaroidY, polaroidW, polaroidH);
    ctx.fillStyle = day.themeColor;
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📍', polaroidX + polaroidW / 2, polaroidY + 72);
    ctx.textAlign = 'left';

    let textY = cursorY + 72;
    const first = day.items[0];
    if (first) {
      ctx.fillStyle = POSTER_COLORS.ink;
      ctx.font = 'bold 22px sans-serif';
      textY = wrapText(ctx, first.name, 56, textY, polaroidX - 72, 28, 2);
      if (first.time) {
        ctx.fillStyle = POSTER_COLORS.inkMuted;
        ctx.font = '18px sans-serif';
        ctx.fillText(first.time, 56, textY);
        textY += 24;
      }
      if (first.desc) {
        ctx.font = '18px sans-serif';
        wrapText(ctx, first.desc, 56, textY + 4, polaroidX - 72, 22, 2);
      }
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
      height - 196,
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
