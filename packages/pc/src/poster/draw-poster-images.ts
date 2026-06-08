import type { PosterCanvasContext } from './types';
import type { PosterImageMap } from './load-poster-image';
import { roundRect } from './draw-utils';

export const MAX_HIGHLIGHT_IMAGES_PER_DAY = 3;

export function getDiaryPhotoStripHeight(imageCount: number): number {
  if (imageCount <= 0) return 0;
  if (imageCount === 1) return 212;
  return 176;
}

function imageSourceSize(source: CanvasImageSource): { w: number; h: number } {
  const img = source as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number };
  const w = img.naturalWidth ?? img.width ?? 1;
  const h = img.naturalHeight ?? img.height ?? 1;
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

/** 居中裁剪绘制（aspectFill） */
export function drawImageCover(
  ctx: PosterCanvasContext,
  source: CanvasImageSource,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 10,
) {
  const { w: iw, h: ih } = imageSourceSize(source);
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;

  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(source, dx, dy, dw, dh);
  ctx.restore();
}

function drawPhotoPlaceholder(
  ctx: PosterCanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.fillStyle = '#e8e0d4';
  ctx.fill();
  ctx.strokeStyle = '#c4b8a4';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  roundRect(ctx, x + 12, y + 12, w - 24, h - 24, radius - 4);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawFramedPhoto(
  ctx: PosterCanvasContext,
  url: string,
  imageMap: PosterImageMap | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  radius: number,
) {
  const frame = 6;
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  ctx.shadowColor = 'rgba(44, 36, 22, 0.32)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, -w / 2 - frame, -h / 2 - frame, w + frame * 2, h + frame * 2, radius + 4);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const img = imageMap?.get(url);
  if (img) {
    drawImageCover(ctx, img, -w / 2, -h / 2, w, h, radius);
  } else {
    drawPhotoPlaceholder(ctx, -w / 2, -h / 2, w, h, radius);
  }

  ctx.restore();
}

/** 手帐日记：照片条（stripY 为照片区域顶部绝对坐标） */
export function drawDiaryPhotoStrip(
  ctx: PosterCanvasContext,
  urls: string[],
  imageMap: PosterImageMap | undefined,
  cardX: number,
  stripY: number,
  cardW: number,
): number {
  const count = Math.min(urls.length, MAX_HIGHLIGHT_IMAGES_PER_DAY);
  if (count <= 0) return 0;

  const padding = 16;
  const innerX = cardX + padding;
  const innerW = cardW - padding * 2;
  const stripH = getDiaryPhotoStripHeight(count) - 12;
  const gap = 12;
  const rotations = [-0.05, 0.02, 0.06];

  if (count === 1) {
    drawFramedPhoto(ctx, urls[0]!, imageMap, innerX, stripY, innerW, stripH, 0, 14);
  } else {
    const imgW = (innerW - gap * (count - 1)) / count;
    urls.slice(0, count).forEach((url, index) => {
      const offsetY = index === 1 ? 0 : index === 0 ? 6 : 10;
      const x = innerX + index * (imgW + gap);
      drawFramedPhoto(
        ctx,
        url,
        imageMap,
        x,
        stripY + offsetY,
        imgW,
        stripH - 12,
        rotations[index] ?? 0,
        10,
      );
    });
  }

  return getDiaryPhotoStripHeight(count);
}

export function getTimelinePhotoStripHeight(imageCount: number): number {
  if (imageCount <= 0) return 0;
  return 88;
}

/** 时间线列：标题下缩略图条 */
export function drawTimelinePhotoStrip(
  ctx: PosterCanvasContext,
  urls: string[],
  imageMap: PosterImageMap | undefined,
  colX: number,
  y: number,
  colW: number,
): number {
  const count = Math.min(urls.length, MAX_HIGHLIGHT_IMAGES_PER_DAY);
  if (count <= 0) return 0;

  const pad = 10;
  const innerX = colX + pad;
  const innerW = colW - pad * 2;
  const h = 72;
  const gap = 8;
  const rotations = [-0.04, 0, 0.04];

  if (count === 1) {
    drawFramedPhoto(ctx, urls[0]!, imageMap, innerX, y, innerW, h, 0, 8);
  } else {
    const imgW = (innerW - gap * (count - 1)) / count;
    urls.slice(0, count).forEach((url, index) => {
      drawFramedPhoto(
        ctx,
        url,
        imageMap,
        innerX + index * (imgW + gap),
        y + (index === 1 ? 0 : 4),
        imgW,
        h - 6,
        rotations[index] ?? 0,
        6,
      );
    });
  }

  return getTimelinePhotoStripHeight(count) + 8;
}
