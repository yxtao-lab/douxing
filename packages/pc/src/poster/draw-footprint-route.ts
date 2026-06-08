import type { PosterCanvasContext } from './types';
import { roundRect } from './draw-utils';

export interface FootprintRoutePoint {
  x: number;
  y: number;
  index: number;
}

interface QuadSegment {
  from: FootprintRoutePoint;
  to: FootprintRoutePoint;
  control: { x: number; y: number };
}

function quadPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function quadTangent(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  return {
    x: 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function insetSegmentEndpoints(
  from: FootprintRoutePoint,
  to: FootprintRoutePoint,
  inset: number,
): { from: FootprintRoutePoint; to: FootprintRoutePoint } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const maxInset = Math.max(0, dist / 2 - 4);
  const pad = Math.min(inset, maxInset);
  return {
    from: { ...from, x: from.x + ux * pad, y: from.y + uy * pad },
    to: { ...to, x: to.x - ux * pad, y: to.y - uy * pad },
  };
}

function buildQuadSegments(points: FootprintRoutePoint[], endpointInset: number): QuadSegment[] {
  const segments: QuadSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const rawFrom = points[i]!;
    const rawTo = points[i + 1]!;
    const { from, to } = insetSegmentEndpoints(rawFrom, rawTo, endpointInset);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const bend = Math.min(dist * 0.22, 48) * (i % 2 === 0 ? 1 : -1);
    const nx = -dy / dist;
    const ny = dx / dist;
    segments.push({
      from,
      to,
      control: { x: mx + nx * bend, y: my + ny * bend },
    });
  }
  return segments;
}

function drawArrowHead(
  ctx: PosterCanvasContext,
  tipX: number,
  tipY: number,
  angle: number,
  size: number,
  fillStyle: string,
) {
  const wing = size * 0.55;
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -wing);
  ctx.lineTo(-size, wing);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** 曲线箭头足迹路径（按打卡顺序，实线 + 渐变 + 多箭头） */
export function drawFootprintArrowRoute(
  ctx: PosterCanvasContext,
  points: FootprintRoutePoint[],
  colors: { accent: string; accentSoft: string },
  endpointInset = 30,
) {
  if (points.length < 2) return;

  const segments = buildQuadSegments(points, endpointInset);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const seg of segments) {
    const grad = ctx.createLinearGradient(seg.from.x, seg.from.y, seg.to.x, seg.to.y);
    grad.addColorStop(0, colors.accentSoft);
    grad.addColorStop(1, colors.accent);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(seg.from.x, seg.from.y);
    ctx.quadraticCurveTo(seg.control.x, seg.control.y, seg.to.x, seg.to.y);
    ctx.stroke();

    const arrowTs = [0.45, 0.72, 0.92];
    for (const t of arrowTs) {
      const pos = quadPoint(t, seg.from, seg.control, seg.to);
      const tan = quadTangent(t, seg.from, seg.control, seg.to);
      const angle = Math.atan2(tan.y, tan.x);
      drawArrowHead(ctx, pos.x, pos.y, angle, 11, colors.accent);
    }
  }

  ctx.restore();
}

/** 足迹方向图例（方向文案 + 序号链） */
export function drawFootprintDirectionLegend(
  ctx: PosterCanvasContext,
  x: number,
  y: number,
  directionLabel: string,
  orderHint: string,
  sequence: number[],
  colors: { accent: string; ink: string; card: string },
) {
  const seqText = sequence.join(' → ');
  const line2 = sequence.length >= 2 ? `${orderHint}  ${seqText}` : orderHint;

  ctx.save();
  ctx.font = 'bold 18px sans-serif';
  const line1W = ctx.measureText(`→ ${directionLabel}`).width;
  ctx.font = '16px sans-serif';
  const line2W = ctx.measureText(line2).width;
  const pillW = Math.max(line1W, line2W) + 24;
  const pillH = 50;

  ctx.fillStyle = `${colors.card}ee`;
  roundRect(ctx, x, y, pillW, pillH, 10);
  ctx.fill();
  ctx.strokeStyle = `${colors.accent}55`;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, pillW, pillH, 10);
  ctx.stroke();

  ctx.fillStyle = colors.accent;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`→ ${directionLabel}`, x + 12, y + 22);

  ctx.fillStyle = colors.ink;
  ctx.font = '16px sans-serif';
  ctx.globalAlpha = 0.88;
  ctx.fillText(line2, x + 12, y + 42);
  ctx.globalAlpha = 1;

  ctx.restore();
}
