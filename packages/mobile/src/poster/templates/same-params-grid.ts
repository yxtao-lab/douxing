import type { PosterCanvasContext, PosterRenderResult } from '../types';
import type { PosterImageMap } from '../load-poster-image';
import { POSTER_WIDTH, POSTER_COLORS, roundRect, wrapText } from '../draw-utils';

const MAX_PHOTOS = 9;
const PADDING = 32;
const GAP = 12;
const FOOTER_HEIGHT = 120;

function gridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

export function estimateSameParamsPosterHeight(photoCount: number, paramSummary: string): number {
  const count = Math.min(Math.max(photoCount, 1), MAX_PHOTOS);
  const { rows } = gridLayout(count);
  const gridW = POSTER_WIDTH - PADDING * 2;
  const cell = (gridW - GAP * (gridLayout(count).cols - 1)) / gridLayout(count).cols;
  const gridH = rows * cell + (rows - 1) * GAP;
  const summaryLines = paramSummary ? 2 : 1;
  return PADDING + 56 + gridH + FOOTER_HEIGHT + summaryLines * 28;
}

export function renderSameParamsGridPoster(
  ctx: PosterCanvasContext,
  options: {
    title: string;
    paramSummary: string;
    photoKeys: string[];
    countLabel: string;
  },
  imageMap?: PosterImageMap,
  canvasHeight?: number,
): PosterRenderResult {
  const width = POSTER_WIDTH;
  const height = canvasHeight ?? estimateSameParamsPosterHeight(options.photoKeys.length, options.paramSummary);

  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = POSTER_COLORS.ink;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(options.title, PADDING, PADDING + 28);

  ctx.fillStyle = POSTER_COLORS.inkMuted;
  ctx.font = '22px sans-serif';
  ctx.fillText(options.countLabel, PADDING, PADDING + 56);

  const count = Math.min(options.photoKeys.length, MAX_PHOTOS);
  const { cols, rows } = gridLayout(count);
  const gridTop = PADDING + 72;
  const gridW = width - PADDING * 2;
  const cell = (gridW - GAP * (cols - 1)) / cols;

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PADDING + col * (cell + GAP);
    const y = gridTop + row * (cell + GAP);
    const key = options.photoKeys[i];

    roundRect(ctx, x, y, cell, cell, 12);
    ctx.fillStyle = POSTER_COLORS.card;
    ctx.fill();

    const img = key ? imageMap?.get(key) : undefined;
    if (img) {
      ctx.save();
      roundRect(ctx, x, y, cell, cell, 12);
      ctx.clip();
      const iw = img.width || cell;
      const ih = img.height || cell;
      const scale = Math.max(cell / iw, cell / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, x + (cell - dw) / 2, y + (cell - dh) / 2, dw, dh);
      ctx.restore();
    }
  }

  const footerY = height - FOOTER_HEIGHT;
  ctx.fillStyle = POSTER_COLORS.footer;
  ctx.fillRect(0, footerY, width, FOOTER_HEIGHT);

  ctx.fillStyle = POSTER_COLORS.footerText;
  ctx.font = '20px sans-serif';
  wrapText(ctx, options.paramSummary, PADDING, footerY + 36, width - PADDING * 2, 26, 2);

  return { height };
}
