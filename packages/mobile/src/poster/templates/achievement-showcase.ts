import type { PosterCanvasContext, PosterRenderResult } from '../types';
import type { PosterImageMap } from '../load-poster-image';
import type { GamificationPosterPayload } from '../types-gamification';
import { drawPosterQr } from '../draw-qr-code';
import {
  POSTER_COLORS,
  POSTER_WIDTH,
  fillPaperBackground,
  drawBrandFooter,
  roundRect,
  wrapText,
  WRAP_LINES_UNLIMITED,
} from '../draw-utils';

const POSTER_MARGIN = 24;
const CONTENT_WIDTH = POSTER_WIDTH - POSTER_MARGIN * 2;
const AVATAR_SIZE = 108;
const FOOTER_HEIGHT = 168;
const GRID_GAP = 16;

function drawAvatar(
  ctx: PosterCanvasContext,
  avatarUrl: string | null,
  cx: number,
  cy: number,
  size: number,
  imageMap?: PosterImageMap,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  if (avatarUrl && imageMap?.get(avatarUrl)) {
    ctx.drawImage(imageMap.get(avatarUrl)!, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = POSTER_COLORS.accent;
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawHeader(ctx: PosterCanvasContext, payload: GamificationPosterPayload, imageMap?: PosterImageMap): number {
  const avatarCx = POSTER_WIDTH / 2;
  const avatarTop = 40;
  const avatarCy = avatarTop + AVATAR_SIZE / 2;

  drawAvatar(ctx, payload.avatarUrl, avatarCx, avatarCy, AVATAR_SIZE, imageMap);

  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(payload.nickname, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 20 + 34);

  ctx.fillStyle = POSTER_COLORS.accent;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(payload.labels.sectionTitle, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 72 + 30);

  ctx.fillStyle = POSTER_COLORS.inkMuted;
  ctx.font = '24px sans-serif';
  ctx.fillText(payload.labels.unlockedCount, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 112 + 24);
  ctx.textAlign = 'left';

  const separatorY = avatarCy + AVATAR_SIZE / 2 + 148;
  ctx.save();
  ctx.fillStyle = POSTER_COLORS.accent;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(POSTER_MARGIN + 48, separatorY, CONTENT_WIDTH - 96, 4);
  ctx.restore();

  return separatorY + 24;
}

function drawBadgeGrid(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
  startY: number,
): number {
  const cols = 2;
  const cardW = (CONTENT_WIDTH - GRID_GAP) / cols;
  const cardH = 168;
  let y = startY;

  for (let i = 0; i < payload.items.length; i += 1) {
    const item = payload.items[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = POSTER_MARGIN + col * (cardW + GRID_GAP);
    const cardY = y + row * (cardH + GRID_GAP);

    ctx.save();
    ctx.fillStyle = POSTER_COLORS.card;
    roundRect(ctx, x, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45, 106, 79, 0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.icon, x + cardW / 2, cardY + 52);

    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.font = 'bold 24px sans-serif';
    wrapText(ctx, item.name, x + 12, cardY + 78, cardW - 24, 28, 2);

    ctx.fillStyle = POSTER_COLORS.inkMuted;
    ctx.font = '20px sans-serif';
    wrapText(ctx, item.description ?? '', x + 12, cardY + 118, cardW - 24, 24, 2);
    ctx.textAlign = 'left';
  }

  const rows = Math.ceil(payload.items.length / cols);
  return y + rows * (cardH + GRID_GAP);
}

function drawAchievementList(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
  startY: number,
): number {
  let y = startY;

  for (const item of payload.items) {
    const cardH = 132;
    const x = POSTER_MARGIN;

    ctx.save();
    ctx.fillStyle = POSTER_COLORS.card;
    roundRect(ctx, x, y, CONTENT_WIDTH, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(45, 106, 79, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.font = '44px sans-serif';
    ctx.fillText(item.icon, x + 20, y + 56);

    ctx.fillStyle = POSTER_COLORS.ink;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(item.name, x + 88, y + 44);

    ctx.fillStyle = POSTER_COLORS.inkMuted;
    ctx.font = '22px sans-serif';
    wrapText(ctx, item.description ?? '', x + 88, y + 72, CONTENT_WIDTH - 108, 26, WRAP_LINES_UNLIMITED);

    y += cardH + GRID_GAP;
  }

  return y;
}

export function estimateGamificationPosterHeight(payload: GamificationPosterPayload): number {
  const headerH = 320;
  if (payload.kind === 'badges') {
    const rows = Math.ceil(payload.items.length / 2);
    return Math.max(900, headerH + rows * 184 + FOOTER_HEIGHT + 48);
  }
  return Math.max(900, headerH + payload.items.length * 148 + FOOTER_HEIGHT + 48);
}

export function measureGamificationPosterHeight(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
): number {
  void ctx;
  return estimateGamificationPosterHeight(payload);
}

export function renderGamificationPoster(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
  imageMap?: PosterImageMap,
  canvasHeight?: number,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = canvasHeight ?? estimateGamificationPosterHeight(payload);

  fillPaperBackground(ctx, width, height);

  const headerBottom = drawHeader(ctx, payload, imageMap);
  const contentBottom =
    payload.kind === 'badges'
      ? drawBadgeGrid(ctx, payload, headerBottom)
      : drawAchievementList(ctx, payload, headerBottom);

  void contentBottom;

  drawBrandFooter(
    ctx,
    width,
    height,
    payload.brand.name,
    payload.brand.tagline,
    payload.brand.scanHint,
    112,
    (qrX, qrY, qrSize) => {
      drawPosterQr(ctx, payload.qrUrl, imageMap, qrX, qrY, qrSize);
    },
  );

  return { width, height };
}
