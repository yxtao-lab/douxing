import type { LatLng } from '@douxing/shared';

export type ProjectedPoint = { x: number; y: number };

export function projectLatLngPoints(
  points: LatLng[],
  width: number,
  height: number,
  padding = 28,
): ProjectedPoint[] {
  if (points.length === 0) return [];

  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);

  const latSpan = Math.max(maxLat - minLat, 0.005);
  const lngSpan = Math.max(maxLng - minLng, 0.005);

  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const lngPerPx = lngSpan / innerW;
  const latPerPx = latSpan / innerH;
  const scale = Math.max(lngPerPx, latPerPx);

  const usedW = lngSpan / scale;
  const usedH = latSpan / scale;
  const offsetX = padding + (innerW - usedW) / 2;
  const offsetY = padding + (innerH - usedH) / 2;

  return points.map((p) => ({
    x: offsetX + ((p.longitude - minLng) / scale),
    y: offsetY + usedH - (p.latitude - minLat) / scale,
  }));
}
