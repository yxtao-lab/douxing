import type { PosterCanvasContext } from './types';

export const POSTER_WIDTH = 750;
export const POSTER_HEIGHT = 1334;

export const POSTER_COLORS = {
  paper: '#f7f0e3',
  card: '#fff9ef',
  ink: '#2c2416',
  inkMuted: '#6b5c48',
  accent: '#2d6a4f',
  tape: 'rgba(255, 214, 153, 0.75)',
  footer: '#1b4332',
  footerText: '#ffffff',
  columnBg: '#fffdf8',
};

export function roundRect(
  ctx: PosterCanvasContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** maxLines <= 0 表示不限制行数、不省略 */
export const WRAP_LINES_UNLIMITED = 0;

/** 计算换行占用高度（不绘制），与 wrapText 断行规则一致 */
export function getWrapTextHeight(
  ctx: PosterCanvasContext,
  text: string,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  if (!text) return 0;
  const unlimited = maxLines <= 0;
  const chars = [...text];
  let line = '';
  let lineCount = 0;

  for (let i = 0; i < chars.length; i += 1) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      line = chars[i] ?? '';
      lineCount += 1;
      if (!unlimited && lineCount >= maxLines - 1) {
        return maxLines * lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  const lines = line ? lineCount + 1 : Math.max(lineCount, 1);
  return Math.max(1, lines) * lineHeight;
}

export function wrapText(
  ctx: PosterCanvasContext,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  if (!text) return y;
  const unlimited = maxLines <= 0;
  const chars = [...text];
  let line = '';
  let lineCount = 0;
  let cursorY = y;

  for (let i = 0; i < chars.length; i += 1) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = chars[i] ?? '';
      cursorY += lineHeight;
      lineCount += 1;
      if (!unlimited && lineCount >= maxLines - 1) {
        const rest = text.slice(i);
        const clipped = rest.length > 0 ? `${rest.slice(0, 12)}…` : line;
        ctx.fillText(clipped, x, cursorY);
        return cursorY + lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
  }
  return cursorY;
}

export function fillPaperBackground(ctx: PosterCanvasContext, width: number, height: number) {
  ctx.fillStyle = POSTER_COLORS.paper;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = POSTER_COLORS.inkMuted;
  ctx.lineWidth = 1;
  for (let y = 48; y < height; y += 28) {
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(width - 32, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBrandFooter(
  ctx: PosterCanvasContext,
  width: number,
  height: number,
  brandName: string,
  tagline: string,
  scanHint: string,
  qrSize: number,
  drawQr: (x: number, y: number, size: number) => void,
) {
  const footerH = 168;
  const footerY = height - footerH;
  ctx.fillStyle = POSTER_COLORS.footer;
  ctx.fillRect(0, footerY, width, footerH);

  const qrX = width - qrSize - 36;
  const qrY = footerY + (footerH - qrSize) / 2;
  drawQr(qrX, qrY, qrSize);

  ctx.fillStyle = POSTER_COLORS.footerText;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(brandName, 36, footerY + 52);
  ctx.font = '22px sans-serif';
  ctx.globalAlpha = 0.92;
  ctx.fillText(tagline, 36, footerY + 88);
  ctx.font = '20px sans-serif';
  ctx.globalAlpha = 0.78;
  wrapText(ctx, scanHint, 36, footerY + 122, width - qrSize - 80, 26, 2);
  ctx.globalAlpha = 1;
}
