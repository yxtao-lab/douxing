import {
  formatShootingParamsSummary,
  type TravelPhotoInfo,
} from '@douxing/shared';

const MAX_PHOTOS = 9;
const WIDTH = 900;
const PADDING = 32;
const GAP = 12;
const FOOTER_HEIGHT = 100;

function gridLayout(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count <= 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: 3 };
}

function estimateHeight(photoCount: number): number {
  const count = Math.min(Math.max(photoCount, 1), MAX_PHOTOS);
  const { cols, rows } = gridLayout(count);
  const gridW = WIDTH - PADDING * 2;
  const cell = (gridW - GAP * (cols - 1)) / cols;
  const gridH = rows * cell + (rows - 1) * GAP;
  return PADDING + 56 + gridH + FOOTER_HEIGHT + 40;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

export async function renderSameParamsCollage(
  photos: TravelPhotoInfo[],
  options: { title: string; countLabel: string },
): Promise<{ canvas: HTMLCanvasElement; dataUrl: string }> {
  const slice = photos.slice(0, MAX_PHOTOS);
  const summary = formatShootingParamsSummary(photos[0]?.shootingParams);
  const height = estimateHeight(slice.length);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unavailable');

  ctx.fillStyle = '#f7f0e3';
  ctx.fillRect(0, 0, WIDTH, height);

  ctx.fillStyle = '#2c2416';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(options.title, PADDING, PADDING + 24);

  ctx.fillStyle = '#6b5c48';
  ctx.font = '18px sans-serif';
  ctx.fillText(options.countLabel, PADDING, PADDING + 48);

  const count = slice.length;
  const { cols } = gridLayout(count);
  const gridTop = PADDING + 64;
  const gridW = WIDTH - PADDING * 2;
  const cell = (gridW - GAP * (cols - 1)) / cols;

  for (let i = 0; i < count; i += 1) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = PADDING + col * (cell + GAP);
    const y = gridTop + row * (cell + GAP);

    ctx.fillStyle = '#fff9ef';
    ctx.beginPath();
    const r = 10;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + cell, y, x + cell, y + cell, r);
    ctx.arcTo(x + cell, y + cell, x, y + cell, r);
    ctx.arcTo(x, y + cell, x, y, r);
    ctx.arcTo(x, y, x + cell, y, r);
    ctx.closePath();
    ctx.fill();

    try {
      const img = await loadImage(slice[i].storedUrl);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + cell, y, x + cell, y + cell, r);
      ctx.arcTo(x + cell, y + cell, x, y + cell, r);
      ctx.arcTo(x, y + cell, x, y, r);
      ctx.arcTo(x, y, x + cell, y, r);
      ctx.closePath();
      ctx.clip();
      const scale = Math.max(cell / img.width, cell / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, x + (cell - dw) / 2, y + (cell - dh) / 2, dw, dh);
      ctx.restore();
    } catch {
      // 单张失败可忽略
    }
  }

  const footerY = height - FOOTER_HEIGHT;
  ctx.fillStyle = '#1b4332';
  ctx.fillRect(0, footerY, WIDTH, FOOTER_HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText(summary, PADDING, footerY + 40);

  return { canvas, dataUrl: canvas.toDataURL('image/jpeg', 0.92) };
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
