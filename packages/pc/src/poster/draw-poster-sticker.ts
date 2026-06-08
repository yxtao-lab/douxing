import type { PosterCanvasContext } from './types';
import type { PosterStickerId } from './poster-options';
import { POSTER_STICKER_EMOJI } from './poster-options';

/** 在顶栏右上角绘制角标贴纸（emoji MVP） */
export function drawPosterSticker(
  ctx: PosterCanvasContext,
  stickerId: PosterStickerId,
  x: number,
  y: number,
  size = 56,
): void {
  if (stickerId === 'none') return;

  const emoji = POSTER_STICKER_EMOJI[stickerId];
  if (!emoji) return;

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(44,36,22,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = `${Math.round(size * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, x + size / 2, y + size / 2 + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}
