import { POSTER_HEIGHT, POSTER_WIDTH } from './draw-utils';

export interface PosterCanvasSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/** 创建离屏 Canvas（Web 端） */
export function createPosterCanvas(canvasHeight = POSTER_HEIGHT): PosterCanvasSurface {
  const canvas = document.createElement('canvas');
  const width = POSTER_WIDTH;
  const height = canvasHeight;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('poster canvas context unavailable');
  }
  ctx.scale(dpr, dpr);
  return { canvas, ctx, width, height };
}

export function exportPosterCanvas(surface: PosterCanvasSurface): Promise<string> {
  const { canvas } = surface;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('export failed'));
          return;
        }
        resolve(URL.createObjectURL(blob));
      },
      'image/png',
      1,
    );
  });
}

/** 浏览器下载 PNG */
export function downloadPosterBlobUrl(blobUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
}

export function revokePosterBlobUrl(blobUrl: string): void {
  if (blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
}
