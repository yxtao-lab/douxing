import type { PosterCanvasContext, PosterRenderResult } from '../types';
import type { PosterImageMap } from '../load-poster-image';
import type { CheckinMapPosterPayload, CheckinMapPosterLocation } from '../types-checkin';
import { drawPosterQr } from '../draw-qr-code';
import { fillThemedBackground, resolvePosterColors } from '../draw-poster-background';
import {
  CHINA_MAP_GEO_BOUNDS,
  computeCheckinMapCardHeight,
  drawChinaMapGrid,
  drawChinaMapSilhouette,
  type MapDrawRect,
} from '../china-map-outline';
import {
  drawFootprintArrowRoute,
  drawFootprintDirectionLegend,
} from '../draw-footprint-route';
import {
  POSTER_WIDTH,
  drawBrandFooter,
  roundRect,
} from '../draw-utils';

const POSTER_MARGIN = 24;
const CONTENT_WIDTH = POSTER_WIDTH - POSTER_MARGIN * 2;
const AVATAR_SIZE = 120;
const MAP_PADDING = 20;
const FOOTER_HEIGHT = 168;
const HEADER_HEIGHT_ESTIMATE = 292;
const POSTER_VERTICAL_GAP = 40;
const MARKER_SIZE = 56;
const MARKER_MIN_DIST = 72;
const LABEL_GAP = 8;
const COORD_KEY_PRECISION = 4;
const COORD_CLUSTER_SPREAD = 0.08;

type PosterPalette = ReturnType<typeof resolvePosterColors>;

interface MapPoint {
  x: number;
  y: number;
  loc: CheckinMapPosterLocation;
  index: number;
}

interface GeoBounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function hasValidCoords(lat: number, lng: number): boolean {
  return lat !== 0 || lng !== 0;
}

function coordClusterKey(lat: number, lng: number): string {
  return `${lat.toFixed(COORD_KEY_PRECISION)}:${lng.toFixed(COORD_KEY_PRECISION)}`;
}

/** 不同城市共用同一 GPS 时，在经纬度上预分散（投影前） */
function spreadDuplicateGeoCoordinates(
  locations: CheckinMapPosterLocation[],
): CheckinMapPosterLocation[] {
  const result = locations.map((loc) => ({ ...loc }));
  const groups = new Map<string, number[]>();

  result.forEach((loc, index) => {
    if (!hasValidCoords(loc.latitude, loc.longitude)) return;
    const key = coordClusterKey(loc.latitude, loc.longitude);
    const bucket = groups.get(key) ?? [];
    bucket.push(index);
    groups.set(key, bucket);
  });

  for (const indices of groups.values()) {
    if (indices.length <= 1) continue;
    const centerLat = result[indices[0]!]!.latitude;
    const centerLng = result[indices[0]!]!.longitude;
    indices.forEach((index, i) => {
      const angle = (i / indices.length) * Math.PI * 2 - Math.PI / 2;
      result[index]!.latitude = centerLat + Math.sin(angle) * COORD_CLUSTER_SPREAD;
      result[index]!.longitude = centerLng + Math.cos(angle) * COORD_CLUSTER_SPREAD;
    });
  }

  return result;
}

/** 无坐标城市：按城市名哈希在有效坐标质心周围占位 */
function fillMissingCoordinates(
  locations: CheckinMapPosterLocation[],
): CheckinMapPosterLocation[] {
  const result = locations.map((loc) => ({ ...loc }));
  const withCoords = result.filter((loc) => hasValidCoords(loc.latitude, loc.longitude));
  const missing = result.filter((loc) => !hasValidCoords(loc.latitude, loc.longitude));
  if (missing.length === 0) return result;

  let baseLat = 35.8617;
  let baseLng = 104.1954;
  if (withCoords.length > 0) {
    baseLat = withCoords.reduce((sum, loc) => sum + loc.latitude, 0) / withCoords.length;
    baseLng = withCoords.reduce((sum, loc) => sum + loc.longitude, 0) / withCoords.length;
  }

  let missingIndex = 0;
  for (const loc of result) {
    if (hasValidCoords(loc.latitude, loc.longitude)) continue;
    const seed = `${loc.city ?? ''}|${loc.name}|${missingIndex}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash * 31 + seed.charCodeAt(i)) | 0;
    }
    const angle = ((hash % 360) * Math.PI) / 180;
    const radius = 0.1 + (missingIndex % 4) * 0.04;
    loc.latitude = baseLat + Math.sin(angle) * radius;
    loc.longitude = baseLng + Math.cos(angle) * radius;
    missingIndex += 1;
  }

  return result;
}

function projectPoints(
  points: CheckinMapPosterLocation[],
  bounds: GeoBounds,
  mapX: number,
  mapY: number,
  mapW: number,
  mapH: number,
): MapPoint[] {
  const { minLng, maxLng, minLat, maxLat } = bounds;
  const lngRange = maxLng - minLng || 1;
  const latRange = maxLat - minLat || 1;
  const drawW = mapW - MAP_PADDING * 2;
  const drawH = mapH - MAP_PADDING * 2;

  return points.map((loc, i) => {
    const nx = (loc.longitude - minLng) / lngRange;
    const ny = (maxLat - loc.latitude) / latRange;
    return {
      x: mapX + MAP_PADDING + nx * drawW,
      y: mapY + MAP_PADDING + ny * drawH,
      loc,
      index: i + 1,
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function layoutCircularCanvasPoints(
  count: number,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: cx, y: cy }];
  const positions: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    positions.push({
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
    });
  }
  return positions;
}

function minPairwiseDistance(points: MapPoint[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dist = Math.hypot(points[i]!.x - points[j]!.x, points[i]!.y - points[j]!.y);
      if (dist < min) min = dist;
    }
  }
  return min;
}

function spreadMapPoints(
  points: MapPoint[],
  minDist: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
): MapPoint[] {
  const result = points.map((p) => ({ ...p }));

  for (let iter = 0; iter < 24; iter += 1) {
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i]!;
        const b = result[j]!;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);

        if (dist < minDist) {
          const push = (minDist - dist) / 2 + 0.5;
          if (dist < 0.5) {
            const angle = ((i + 1) * (j + 3) * 0.618) % (Math.PI * 2);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            dist = 1;
          }
          const ox = (dx / dist) * push;
          const oy = (dy / dist) * push;
          a.x -= ox;
          a.y -= oy;
          b.x += ox;
          b.y += oy;
        }
      }
    }
    for (const pt of result) {
      pt.x = clamp(pt.x, bounds.minX, bounds.maxX);
      pt.y = clamp(pt.y, bounds.minY, bounds.maxY);
    }
  }

  return result;
}

function resolveMapPointLayout(
  locations: CheckinMapPosterLocation[],
  mapX: number,
  innerTop: number,
  mapW: number,
  innerH: number,
): MapPoint[] {
  const prepared = fillMissingCoordinates(spreadDuplicateGeoCoordinates(locations));
  if (prepared.length === 0) return [];

  const innerLeft = mapX + MARKER_SIZE / 2 + 4;
  const innerRight = mapX + mapW - MARKER_SIZE / 2 - 4;
  const innerBottom = innerTop + innerH - MARKER_SIZE / 2 - 28;
  const innerCenterX = (innerLeft + innerRight) / 2;
  const innerCenterY = (innerTop + MARKER_SIZE / 2 + innerBottom) / 2;
  const layoutBounds = {
    minX: innerLeft,
    maxX: innerRight,
    minY: innerTop + MARKER_SIZE / 2,
    maxY: innerBottom,
  };

  let projected = projectPoints(
    prepared,
    { ...CHINA_MAP_GEO_BOUNDS },
    mapX,
    innerTop,
    mapW,
    innerH,
  );

  if (projected.length > 1 && minPairwiseDistance(projected) < MARKER_MIN_DIST * 0.65) {
    const radiusX = Math.max(60, (innerRight - innerLeft) / 2 - MARKER_SIZE);
    const radiusY = Math.max(48, (innerBottom - layoutBounds.minY) / 2 - MARKER_SIZE);
    const ring = layoutCircularCanvasPoints(
      projected.length,
      innerCenterX,
      innerCenterY,
      radiusX,
      radiusY,
    );
    projected = projected.map((pt, i) => ({
      ...pt,
      x: ring[i]?.x ?? pt.x,
      y: ring[i]?.y ?? pt.y,
    }));
  }

  return spreadMapPoints(projected, MARKER_MIN_DIST, layoutBounds);
}

function shortPlaceLabel(city: string | null, name: string, maxLen = 6): string {
  const raw = (city || name || '').trim();
  if (!raw) return '';
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}…`;
}

function drawRoundedMarkerImage(
  ctx: PosterCanvasContext,
  img: CanvasImageSource | undefined,
  cx: number,
  cy: number,
  size: number,
  accent: string,
) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const radius = 10;

  ctx.save();
  ctx.fillStyle = 'rgba(44, 36, 22, 0.16)';
  roundRect(ctx, x + 2, y + 3, size, size, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawIndexBadge(
  ctx: PosterCanvasContext,
  cx: number,
  cy: number,
  size: number,
  index: number,
  accent: string,
) {
  const badgeR = 12;
  const bx = cx - size / 2 + 4 + badgeR;
  const by = cy - size / 2 + 4 + badgeR;
  ctx.save();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(index), bx, by + 1);
  ctx.restore();
}

const MAP_HORIZONTAL_INSET = 8;

function checkinMapWidth(): number {
  return CONTENT_WIDTH - MAP_HORIZONTAL_INSET * 2;
}

export function estimateCheckinMapPosterHeight(_payload?: CheckinMapPosterPayload): number {
  void _payload;
  const mapW = checkinMapWidth();
  const mapCardH = computeCheckinMapCardHeight(mapW, MAP_PADDING);
  return HEADER_HEIGHT_ESTIMATE + mapCardH + FOOTER_HEIGHT + POSTER_VERTICAL_GAP;
}

export function measureCheckinMapPosterHeight(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
): number {
  void ctx;
  return estimateCheckinMapPosterHeight(payload);
}

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

  const img = avatarUrl ? imageMap?.get(avatarUrl) : undefined;
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = accent;
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawHeader(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
  colors: PosterPalette,
  imageMap?: PosterImageMap,
): number {
  const avatarCx = POSTER_WIDTH / 2;
  const avatarTop = 48;
  const avatarCy = avatarTop + AVATAR_SIZE / 2;

  drawAvatar(ctx, payload.avatarUrl, avatarCx, avatarCy, AVATAR_SIZE, colors.accent, imageMap);

  ctx.fillStyle = colors.ink;
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(payload.nickname, POSTER_WIDTH / 2, avatarCy + AVATAR_SIZE / 2 + 16 + 36);

  const statsY = avatarCy + AVATAR_SIZE / 2 + 64 + 36;
  const statsParts = [
    `${payload.checkinCount} ${payload.labels.checkins}`,
    `${payload.cityCount} ${payload.labels.cities}`,
    `${payload.totalPoints} ${payload.labels.points}`,
  ];
  ctx.fillStyle = colors.inkMuted;
  ctx.font = '26px sans-serif';
  ctx.fillText(statsParts.join('  ·  '), POSTER_WIDTH / 2, statsY);
  ctx.textAlign = 'left';

  const separatorY = statsY + 16;
  ctx.save();
  ctx.fillStyle = colors.accent;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(POSTER_MARGIN + 40, separatorY, CONTENT_WIDTH - 80, 4);
  ctx.restore();

  return separatorY + 16;
}

function drawMapArea(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
  y: number,
  height: number,
  colors: PosterPalette,
  imageMap?: PosterImageMap,
): void {
  const mapX = POSTER_MARGIN + MAP_HORIZONTAL_INSET;
  const mapW = checkinMapWidth();
  const mapY = y;
  const mapH = height;

  ctx.save();
  ctx.fillStyle = colors.card;
  roundRect(ctx, mapX - 4, mapY - 8, mapW + 8, mapH + 16, 12);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = colors.inkMuted;
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(payload.labels.mapTitle, POSTER_WIDTH / 2, mapY + 32);
  ctx.textAlign = 'left';

  if (payload.checkinLocations.length === 0) {
    ctx.fillStyle = colors.inkMuted;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(payload.labels.noMapData, POSTER_WIDTH / 2, mapY + mapH / 2);
    ctx.textAlign = 'left';
    return;
  }

  const innerTop = mapY + 56;
  const innerH = mapH - 56 - 20;
  const mapRect: MapDrawRect = {
    x: mapX,
    y: innerTop,
    w: mapW,
    h: innerH,
    padding: MAP_PADDING,
  };
  const spread = resolveMapPointLayout(payload.checkinLocations, mapX, innerTop, mapW, innerH);

  if (spread.length === 0) {
    ctx.fillStyle = colors.inkMuted;
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(payload.labels.noMapData, POSTER_WIDTH / 2, mapY + mapH / 2);
    ctx.textAlign = 'left';
    return;
  }

  drawChinaMapSilhouette(ctx, mapRect, { accent: colors.accent, paper: colors.paper });
  drawChinaMapGrid(ctx, mapRect, `${colors.accent}12`);

  if (spread.length >= 2) {
    drawFootprintArrowRoute(
      ctx,
      spread.map((pt) => ({ x: pt.x, y: pt.y, index: pt.index })),
      {
        accent: colors.accent,
        accentSoft: `${colors.accent}66`,
      },
    );
  }

  const legendX = mapX + 12;
  const legendY = innerTop + innerH - 58;
  drawFootprintDirectionLegend(
    ctx,
    legendX,
    legendY,
    payload.labels.footprintDirection,
    payload.labels.footprintByTime,
    spread.map((pt) => pt.index),
    { accent: colors.accent, ink: colors.ink, card: colors.card },
  );

  for (const pt of spread) {
    const photoUrl = pt.loc.photoUrl?.trim();
    const img = photoUrl ? imageMap?.get(photoUrl) : undefined;
    drawRoundedMarkerImage(ctx, img, pt.x, pt.y, MARKER_SIZE, colors.accent);
    drawIndexBadge(ctx, pt.x, pt.y, MARKER_SIZE, pt.index, colors.accent);

    const label = shortPlaceLabel(pt.loc.city, pt.loc.name);
    if (label) {
      ctx.save();
      ctx.fillStyle = colors.ink;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, pt.x, pt.y + MARKER_SIZE / 2 + LABEL_GAP + 16);
      ctx.restore();
    }
  }
}

export function renderCheckinMapPoster(
  ctx: PosterCanvasContext,
  payload: CheckinMapPosterPayload,
  imageMap?: PosterImageMap,
  canvasHeight?: number,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const mapW = checkinMapWidth();
  const mapCardH = computeCheckinMapCardHeight(mapW, MAP_PADDING);
  const height = canvasHeight ?? estimateCheckinMapPosterHeight(payload);
  const colors = resolvePosterColors(payload.themePresetId);

  fillThemedBackground(ctx, width, height, payload.themePresetId);

  const headerBottom = drawHeader(ctx, payload, colors, imageMap);

  drawMapArea(ctx, payload, headerBottom, mapCardH, colors, imageMap);

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
