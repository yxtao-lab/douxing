import type { PosterCanvasContext, PosterRenderResult } from '../types';
import type { PosterImageMap } from '../load-poster-image';
import type { GamificationPosterPayload } from '../types-gamification';
import { drawPosterQr } from '../draw-qr-code';
import { fillThemedBackground, resolvePosterColors } from '../draw-poster-background';
import {
  POSTER_WIDTH,
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

type PosterPalette = ReturnType<typeof resolvePosterColors>;

function drawAvatar(
  ctx: PosterCanvasContext,
  avatarUrl: string | null,
  cx: number,
  cy: number,
  size: number,
  accent: string,
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
    ctx.fillStyle = accent;
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
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

function drawHeader(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
  colors: PosterPalette,
  imageMap?: PosterImageMap,
): number {
  const avatarCx = POSTER_WIDTH / 2;
  const avatarTop = 40;
  const avatarCy = avatarTop + AVATAR_SIZE / 2;

  drawAvatar(ctx, payload.avatarUrl, avatarCx, avatarCy, AVATAR_SIZE, colors.accent, imageMap);

  ctx.fillStyle = colors.ink;
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(payload.nickname, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 20 + 34);

  ctx.fillStyle = colors.accent;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(payload.labels.sectionTitle, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 72 + 30);

  ctx.fillStyle = colors.inkMuted;
  ctx.font = '24px sans-serif';
  ctx.fillText(payload.labels.unlockedCount, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 112 + 24);
  ctx.textAlign = 'left';

  const separatorY = avatarCy + AVATAR_SIZE / 2 + 148;
  ctx.save();
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(POSTER_MARGIN + 48, separatorY, CONTENT_WIDTH - 96, 4);
  ctx.restore();

  return separatorY + 24;
}

function drawBadgeGrid(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
  startY: number,
  colors: PosterPalette,
): number {
  const cols = 2;
  const cardW = Math.floor((CONTENT_WIDTH - GRID_GAP) / cols);
  const cardH = 132;
  const pad = 14;
  const iconColW = 52;
  const textX = pad + iconColW + 8;
  const textW = cardW - textX - pad;

  for (let i = 0; i < payload.items.length; i += 1) {
    const item = payload.items[i]!;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = POSTER_MARGIN + col * (cardW + GRID_GAP);
    const cardY = startY + row * (cardH + GRID_GAP);

    ctx.save();
    ctx.fillStyle = colors.card;
    roundRect(ctx, x, cardY, cardW, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = `${colors.accent}2e`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '40px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(item.icon, x + pad, cardY + pad + 36);

    ctx.fillStyle = colors.ink;
    ctx.font = 'bold 22px sans-serif';
    wrapText(ctx, item.name, x + textX, cardY + pad + 28, textW, 26, 2);

    ctx.fillStyle = colors.inkMuted;
    ctx.font = '18px sans-serif';
    wrapText(ctx, item.description ?? '', x + textX, cardY + pad + 58, textW, 22, 2);
    ctx.restore();
  }

  const rows = Math.ceil(payload.items.length / cols);
  return startY + rows * (cardH + GRID_GAP);
}

function drawAchievementList(
  ctx: PosterCanvasContext,
  payload: GamificationPosterPayload,
  startY: number,
  colors: PosterPalette,
): number {
  let y = startY;

  for (const item of payload.items) {
    const cardH = 132;
    const x = POSTER_MARGIN;

    ctx.save();
    ctx.fillStyle = colors.card;
    roundRect(ctx, x, y, CONTENT_WIDTH, cardH, 12);
    ctx.fill();
    ctx.strokeStyle = `${colors.accent}26`;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '44px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(item.icon, x + 20, y + 56);

    ctx.fillStyle = colors.ink;
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(item.name, x + 88, y + 44);

    ctx.fillStyle = colors.inkMuted;
    ctx.font = '22px sans-serif';
    wrapText(ctx, item.description ?? '', x + 88, y + 72, CONTENT_WIDTH - 108, 26, WRAP_LINES_UNLIMITED);
    ctx.restore();

    y += cardH + GRID_GAP;
  }

  return y;
}

export function estimateGamificationPosterHeight(payload: GamificationPosterPayload): number {
  const headerH = 320;
  if (payload.kind === 'badges') {
    const rows = Math.ceil(payload.items.length / 2);
    return Math.max(900, headerH + rows * 148 + FOOTER_HEIGHT + 48);
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
  const colors = resolvePosterColors(payload.themePresetId);

  fillThemedBackground(ctx, width, height, payload.themePresetId);

  const headerBottom = drawHeader(ctx, payload, colors, imageMap);
  const contentBottom =
    payload.kind === 'badges'
      ? drawBadgeGrid(ctx, payload, headerBottom, colors)
      : drawAchievementList(ctx, payload, headerBottom, colors);

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
    colors.footer,
  );

  return { width, height };
}
