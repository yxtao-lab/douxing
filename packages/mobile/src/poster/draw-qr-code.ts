import qrcode from 'qrcode-generator';
import type { PosterCanvasContext } from './types';
import type { PosterImageMap } from './load-poster-image';
import { POSTER_WXACODE_KEY } from './load-poster-image';

/**
 * 在 Canvas 上绘制标准 QR 码（URL Link / H5 等文本链接）。
 *
 * @param ctx - Canvas 2D 上下文
 * @param url - 写入二维码的完整 URL
 * @param x - 左上角 x
 * @param y - 左上角 y
 * @param size - 正方形边长（像素）
 * @returns void
 */
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

/**
 * 绘制已加载的小程序码 PNG。
 *
 * @param ctx - Canvas 2D 上下文
 * @param image - 小程序码图片源
 * @param x - 左上角 x
 * @param y - 左上角 y
 * @param size - 正方形边长（像素）
 * @returns void
 */
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

/**
 * 在海报底栏绘制二维码：优先服务端小程序码（微信扫一扫直达小程序），
 * 其次 H5 / URL Link 标准 QR，均无则画占位。
 *
 * @param ctx - Canvas 2D 上下文
 * @param qrUrl - 标准 QR 编码的 URL；仅在无小程序码时使用
 * @param imageMap - 已加载图片映射，可含 `POSTER_WXACODE_KEY`
 * @param x - 左上角 x
 * @param y - 左上角 y
 * @param size - 正方形边长（像素）
 * @returns void
 */
export function drawPosterQr(
  ctx: PosterCanvasContext,
  qrUrl: string | null,
  imageMap: PosterImageMap | undefined,
  x: number,
  y: number,
  size: number,
) {
  const wxacode = imageMap?.get(POSTER_WXACODE_KEY);
  if (wxacode) {
    drawQrImage(ctx, wxacode, x, y, size);
    return;
  }
  if (qrUrl) {
    drawQrCode(ctx, qrUrl, x, y, size);
    return;
  }
  drawQrPlaceholder(ctx, x, y, size);
}

/**
 * 绘制无可用二维码时的半透明占位方块。
 *
 * @param ctx - Canvas 2D 上下文
 * @param x - 左上角 x
 * @param y - 左上角 y
 * @param size - 正方形边长（像素）
 * @returns void
 */
export function drawQrPlaceholder(ctx: PosterCanvasContext, x: number, y: number, size: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 8, size - 16, size - 16);
  ctx.restore();
}
