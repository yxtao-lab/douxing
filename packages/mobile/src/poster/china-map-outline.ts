import type { PosterCanvasContext } from './types';
import { CHINA_OUTLINE_RINGS } from './data/china-outline-rings';

/** 海报投影范围（略裁南海远岛，突出陆域与海南） */
export const CHINA_MAP_GEO_BOUNDS = {
  minLng: 73.62,
  maxLng: 135.04,
  minLat: 18.0,
  maxLat: 53.5,
} as const;

const LNG_SPAN = CHINA_MAP_GEO_BOUNDS.maxLng - CHINA_MAP_GEO_BOUNDS.minLng;
const LAT_SPAN = CHINA_MAP_GEO_BOUNDS.maxLat - CHINA_MAP_GEO_BOUNDS.minLat;
/** 中国地图宽/高（经纬跨度比） */
export const CHINA_MAP_GEO_ASPECT = LNG_SPAN / LAT_SPAN;

export interface MapDrawRect {
  x: number;
  y: number;
  w: number;
  h: number;
  padding: number;
}

type LngLat = readonly [number, number];

export function projectLngLatToRect(
  lng: number,
  lat: number,
  rect: MapDrawRect,
  bounds: typeof CHINA_MAP_GEO_BOUNDS = CHINA_MAP_GEO_BOUNDS,
): { x: number; y: number } {
  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;
  const drawW = rect.w - rect.padding * 2;
  const drawH = rect.h - rect.padding * 2;
  const nx = (lng - bounds.minLng) / lngRange;
  const ny = (bounds.maxLat - lat) / latRange;
  return {
    x: rect.x + rect.padding + nx * drawW,
    y: rect.y + rect.padding + ny * drawH,
  };
}

/** 按真实宽高比计算地图内区高度（保证轮廓不被压扁） */
export function computeChinaMapInnerHeight(mapW: number, padding: number): number {
  const drawW = Math.max(1, mapW - padding * 2);
  return Math.round(drawW / CHINA_MAP_GEO_ASPECT + padding * 2);
}

/** 足迹地图卡片总高（含标题区） */
export function computeCheckinMapCardHeight(mapW: number, padding: number): number {
  const mapTitleBand = 56;
  const mapBottomPad = 20;
  return mapTitleBand + computeChinaMapInnerHeight(mapW, padding) + mapBottomPad;
}

function traceRing(
  ctx: PosterCanvasContext,
  ring: LngLat[],
  rect: MapDrawRect,
) {
  ring.forEach(([lng, lat], index) => {
    const { x, y } = projectLngLatToRect(lng, lat, rect);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

function clipToMapInner(ctx: PosterCanvasContext, rect: MapDrawRect) {
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
}

/** 绘制 DataV 真实国界剪影（多 ring：大陆、海南、台湾等） */
export function drawChinaMapSilhouette(
  ctx: PosterCanvasContext,
  rect: MapDrawRect,
  colors: { accent: string; paper: string },
) {
  ctx.save();
  clipToMapInner(ctx, rect);

  const fillStyle = `${colors.accent}16`;
  ctx.fillStyle = fillStyle;
  for (const ring of CHINA_OUTLINE_RINGS) {
    ctx.beginPath();
    traceRing(ctx, ring, rect);
    ctx.fill();
  }

  ctx.strokeStyle = `${colors.accent}55`;
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  for (const ring of CHINA_OUTLINE_RINGS) {
    ctx.beginPath();
    traceRing(ctx, ring, rect);
    ctx.stroke();
  }

  ctx.restore();
}

/** 地图区内淡色经纬网格 */
export function drawChinaMapGrid(
  ctx: PosterCanvasContext,
  rect: MapDrawRect,
  strokeColor: string,
) {
  ctx.save();
  clipToMapInner(ctx, rect);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  const lngStep = 5;
  const latStep = 4;
  for (let lng = CHINA_MAP_GEO_BOUNDS.minLng; lng <= CHINA_MAP_GEO_BOUNDS.maxLng; lng += lngStep) {
    const top = projectLngLatToRect(lng, CHINA_MAP_GEO_BOUNDS.maxLat, rect);
    const bottom = projectLngLatToRect(lng, CHINA_MAP_GEO_BOUNDS.minLat, rect);
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.stroke();
  }
  for (let lat = CHINA_MAP_GEO_BOUNDS.minLat; lat <= CHINA_MAP_GEO_BOUNDS.maxLat; lat += latStep) {
    const left = projectLngLatToRect(CHINA_MAP_GEO_BOUNDS.minLng, lat, rect);
    const right = projectLngLatToRect(CHINA_MAP_GEO_BOUNDS.maxLng, lat, rect);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
  ctx.restore();
}
