import qrcode from 'qrcode-generator';
import type { PosterCanvasContext } from './types';
import type { PosterImageMap } from './load-poster-image';
import { POSTER_WXACODE_KEY } from './load-poster-image';

/** 在 Canvas 上绘制 QR 码（D5-a H5 链接） */
export function drawQrCode(
  ctx: PosterCanvasContext,
  url: string,
  x: number,
  y: number,
  size: number,
) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const cell = size / count;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#111111';
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) {
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
  }
  ctx.restore();
}

/** 绘制已加载的小程序码图片 */
export function drawQrImage(
  ctx: PosterCanvasContext,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.drawImage(image, x, y, size, size);
  ctx.restore();
}

/** 海报底栏二维码：H5 链接优先，其次服务端小程序码，最后占位 */
export function drawPosterQr(
  ctx: PosterCanvasContext,
  qrUrl: string | null,
  imageMap: PosterImageMap | undefined,
  x: number,
  y: number,
  size: number,
) {
  if (qrUrl) {
    drawQrCode(ctx, qrUrl, x, y, size);
    return;
  }
  const wxacode = imageMap?.get(POSTER_WXACODE_KEY);
  if (wxacode) {
    drawQrImage(ctx, wxacode, x, y, size);
    return;
  }
  drawQrPlaceholder(ctx, x, y, size);
}

/** 无 H5 链接时的占位方块 */
export function drawQrPlaceholder(ctx: PosterCanvasContext, x: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 8, size - 16, size - 16);
  ctx.restore();
}
