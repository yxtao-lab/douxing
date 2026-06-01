import { POSTER_HEIGHT, POSTER_WIDTH } from './draw-utils';

type CanvasNode = HTMLCanvasElement | Record<string, unknown>;

export interface PosterCanvasSurface {
  canvas: CanvasNode;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

/** 获取 type=2d 画布节点（小程序 / H5 通用） */
export function queryPosterCanvas(
  canvasId: string,
  componentInstance?: unknown,
): Promise<PosterCanvasSurface> {
  return new Promise((resolve, reject) => {
    let query = uni.createSelectorQuery();
    if (componentInstance) {
      query = query.in(componentInstance);
    }
    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true }, (res) => {
        const result = res as { node?: CanvasNode; width?: number; height?: number };
        const canvas = result.node;
        if (!canvas) {
          reject(new Error('poster canvas not found'));
          return;
        }
        const width = POSTER_WIDTH;
        const height = POSTER_HEIGHT;
        const dpr = uni.getSystemInfoSync().pixelRatio || 2;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const ctx = (canvas as HTMLCanvasElement).getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctx) {
          reject(new Error('poster canvas context unavailable'));
          return;
        }
        ctx.scale(dpr, dpr);
        resolve({ canvas, ctx, width, height });
      })
      .exec();
  });
}

export function exportPosterCanvas(surface: PosterCanvasSurface): Promise<string> {
  const { canvas, width, height } = surface;
  const dpr = uni.getSystemInfoSync().pixelRatio || 2;
  return new Promise((resolve, reject) => {
    uni.canvasToTempFilePath({
      canvas,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width * dpr,
      destHeight: height * dpr,
      fileType: 'png',
      quality: 1,
      success: (res) => resolve(res.tempFilePath),
      fail: (err) => reject(new Error(err.errMsg || 'export failed')),
    } as UniApp.CanvasToTempFilePathOptions);
  });
}

/** 保存海报到系统相册（含权限引导） */
export async function savePosterToAlbum(filePath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    uni.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(),
      fail: (err) => {
        if (err.errMsg?.includes('auth deny') || err.errMsg?.includes('authorize')) {
          reject(new Error('album_permission_denied'));
          return;
        }
        reject(new Error(err.errMsg || 'save failed'));
      },
    });
  });
}

export function openAlbumSetting(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.openSetting({
      success: (res) => {
        resolve(Boolean(res.authSetting['scope.writePhotosAlbum']));
      },
      fail: () => resolve(false),
    });
  });
}
