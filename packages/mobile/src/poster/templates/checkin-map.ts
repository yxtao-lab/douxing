import type { PosterCanvasContext, PosterRenderResult } from '../types';
import type { PosterImageMap } from '../load-poster-image';
import type { CheckinMapPosterPayload, CheckinMapPosterLocation } from '../types-checkin';
import { drawPosterQr } from '../draw-qr-code';
import {
  POSTER_COLORS,
  POSTER_WIDTH,
  fillPaperBackground,
  drawBrandFooter,
  roundRect,
} from '../draw-utils';

const POSTER_MARGIN = 24;
const CONTENT_WIDTH = POSTER_WIDTH - POSTER_MARGIN * 2;
const AVATAR_SIZE = 120;
const MAP_PADDING = 30;
const FOOTER_HEIGHT = 168;
const DOT_RADIUS = 14;
const LABEL_OFFSET_Y = 24;

/** 地图点的像素坐标 */
interface MapPoint {
  x: number;
  y: number;
  loc: CheckinMapPosterLocation;
  index: number;
}

/** 计算 Geo 边界 */
function geoBounds(
  points: CheckinMapPosterLocation[],
): { minLng: number; maxLng: number; minLat: number; maxLat: number } | null {
  const valid = points.filter((p) => p.latitude !== 0 || p.longitude !== 0);
  if (valid.length === 0) return null;
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  for (const p of valid) {
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
  }
  return { minLng, maxLng, minLat, maxLat };
}

/** 将地理坐标映射为 Canvas 像素坐标 */
function projectPoints(
  points: CheckinMapPosterLocation[],
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  mapX: number,
  mapY: number,
  mapW: number,
  mapH: number,
): MapPoint[] {
  const { minLng, maxLng, minLat, maxLat } = bounds;
  const lngRange = maxLng - minLng || 1;
  const latRange = maxLat - minLat || 1;
  const padX = MAP_PADDING;
  const padY = MAP_PADDING;
  const drawW = mapW - padX * 2;
  const drawH = mapH - padY * 2;

  return points.map((loc, i) => {
    if (loc.latitude === 0 && loc.longitude === 0) {
      return { x: mapX + mapW / 2, y: mapY + mapH / 2, loc, index: i + 1 };
    }
    const nx = (loc.longitude - minLng) / lngRange;
    const ny = (maxLat - loc.latitude) / latRange; // lat inverted for canvas
    return {
      x: mapX + padX + nx * drawW,
      y: mapY + padY + ny * drawH,
      loc,
      index: i + 1,
    };
  });
}

/** 前置计算画布高度（无 canvas 估算） */
export function estimateCheckinMapPosterHeight(payload: CheckinMapPosterPayload): number {
  let h = 280; // header
  const locationCount = Math.max(payload.checkinLocations.length, 1);
  const mapH = 160 + Math.min(locationCount, 20) * 20; // dynamic map height
  h += mapH + 24;
  h += FOOTER_HEIGHT;
  return Math.max(800, Math.min(2500, h));
}

/** 测量实际高度 */
export function measureCheckinMapPosterHeight(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
): number {
  return estimateCheckinMapPosterHeight(payload);
}

/** 绘制圆形头像 */
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

  if (avatarUrl) {
    const img = imageMap?.get(avatarUrl);
    if (img) {
      ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    } else {
      // fallback placeholder
      ctx.fillStyle = POSTER_COLORS.accent;
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    }
  } else {
    ctx.fillStyle = POSTER_COLORS.accent;
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    // Draw initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  ctx.restore();

  // Draw subtle border
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** 绘制顶栏用户信息 */
function drawHeader(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
  imageMap?: PosterImageMap,
): number {
  const avatarCx = POSTER_WIDTH / 2;
  const avatarTop = 48;
  const avatarCy = avatarTop + AVATAR_SIZE / 2;

  drawAvatar(ctx, payload.avatarUrl, avatarCx, avatarCy, AVATAR_SIZE, imageMap);

  // Nickname
  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(payload.nickname, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 16 + 36);
  ctx.textAlign = 'left';

  // Stats row
  const statsY = avatarCy + AVATAR_SIZE / 2 + 64 + 36;
  const statsParts = [
    `${payload.checkinCount} ${payload.labels.checkins}`,
    `${payload.cityCount} ${payload.labels.cities}`,
    `${payload.totalPoints} ${payload.labels.points}`,
  ];
  const statsText = statsParts.join('  ·  ');
  ctx.fillStyle = POSTER_COLORS.inkMuted;
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(statsText, POSTER_WIDTH / 2, statsY);
  ctx.textAlign = 'left';

  const separatorY = statsY + 16;

  // Accent separator line
  ctx.save();
  ctx.fillStyle = POSTER_COLORS.accent;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(POSTER_MARGIN + 40, separatorY, CONTENT_WIDTH - 80, 4);
  ctx.restore();

  return separatorY + 16; // return bottom of header
}

/** 绘制简化足迹地图 */
function drawMapArea(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
  y: number,
  height: number,
): void {
  const mapX = POSTER_MARGIN + 20;
  const mapW = CONTENT_WIDTH - 40;
  const mapY = y;
  const mapH = height;

  // Map background card
  ctx.save();
  ctx.fillStyle = POSTER_COLORS.card;
  roundRect(ctx, mapX - 4, mapY - 8, mapW + 8, mapH + 16, 12);
  ctx.fill();
  ctx.restore();

  // Section label
  ctx.fillStyle = POSTER_COLORS.inkMuted;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(payload.labels.mapTitle, POSTER_WIDTH / 2, mapY + 32);
  ctx.textAlign = 'left';

  const valid = payload.checkinLocations.filter(
    (l) => l.latitude !== 0 || l.longitude !== 0,
  );
  if (valid.length === 0) {
    ctx.fillStyle = POSTER_COLORS.inkMuted;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(payload.labels.noMapData, POSTER_WIDTH / 2, mapY + mapH / 2);
    ctx.textAlign = 'left';
    return;
  }

  const bounds = geoBounds(valid);
  if (!bounds) return;

  const innerTop = mapY + 56;
  const innerH = mapH - 56 - 16;

  // Shift projectPoints to use the correct inner area
  const innerMapPoints = projectPoints(valid, bounds, mapX, innerTop, mapW, innerH);

  // Draw subtle grid dots
  ctx.save();
  ctx.fillStyle = 'rgba(44, 36, 22, 0.12)';
  for (let gx = mapX + 40; gx < mapX + mapW; gx += 50) {
    for (let gy = innerTop + 20; gy < innerTop + innerH - 10; gy += 50) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // Draw connecting lines
  if (innerMapPoints.length >= 2) {
    ctx.save();
    ctx.strokeStyle = 'rgba(45, 106, 79, 0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(innerMapPoints[0].x, innerMapPoints[0].y);
    for (let i = 1; i < innerMapPoints.length; i++) {
      ctx.lineTo(innerMapPoints[i].x, innerMapPoints[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Draw dots
  for (const pt of innerMapPoints) {
    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(44, 36, 22, 0.18)';
    ctx.beginPath();
    ctx.arc(pt.x + 2, pt.y + 3, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Main dot
    ctx.save();
    ctx.fillStyle = POSTER_COLORS.accent;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Number badge
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(pt.index), pt.x, pt.y + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.restore();

    // Label
    const label = pt.loc.city || pt.loc.name;
    if (label) {
      ctx.save();
      ctx.fillStyle = POSTER_COLORS.ink;
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, pt.x, pt.y + DOT_RADIUS + LABEL_OFFSET_Y);
      ctx.textAlign = 'left';
      ctx.restore();
    }
  }
}

/** 主渲染函数 */
export function renderCheckinMapPoster(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
  imageMap?: PosterImageMap,
  canvasHeight?: number,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = canvasHeight ?? estimateCheckinMapPosterHeight(payload);

  // Background
  fillPaperBackground(ctx, width, height);

  // Header
  const headerBottom = drawHeader(ctx, payload, imageMap);

  // Map area
  const mapAvailableH = height - headerBottom - FOOTER_HEIGHT - 40;
  const mapH = Math.max(300, mapAvailableH);

  drawMapArea(ctx, payload, headerBottom, mapH);

  // Brand footer with QR
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
