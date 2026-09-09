import type { PosterPayload } from './types';
import { getApiBaseUrl } from '@/utils/api-base';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';

type PosterCanvasNode = HTMLCanvasElement | Record<string, unknown>;

export type PosterImageMap = Map<string, CanvasImageSource>;

/** imageMap 中小程序码占位 key */
export const POSTER_WXACODE_KEY = '__poster_wxacode__';

function isArrayBufferLike(data: unknown): data is ArrayBuffer {
  if (data instanceof ArrayBuffer) return true;
  return Object.prototype.toString.call(data) === '[object ArrayBuffer]';
}

export async function loadPosterImage(
  canvas: PosterCanvasNode,
  url: string,
): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const createImage = (canvas as { createImage?: () => HTMLImageElement }).createImage;
    if (typeof createImage === 'function') {
      const img = createImage.call(canvas);
      img.onload = () => resolve(img as unknown as CanvasImageSource);
      img.onerror = () => reject(new Error('poster image load failed'));
      img.src = url;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('poster image load failed'));
    img.src = url;
  });
}

async function loadPosterImageFromBuffer(
  canvas: PosterCanvasNode,
  buffer: ArrayBuffer,
  routeId: number,
): Promise<CanvasImageSource> {
  const platform = import.meta.env.UNI_PLATFORM as string | undefined;

  if (platform === 'mp-weixin') {
    return new Promise((resolve, reject) => {
      const fs = uni.getFileSystemManager();
      const userPath =
        (globalThis as { wx?: { env?: { USER_DATA_PATH?: string } } }).wx?.env?.USER_DATA_PATH ??
        '';
      const filePath = `${userPath}/poster_wxacode_${routeId}.png`;
      fs.writeFile({
        filePath,
        data: buffer,
        success: () => {
          void loadPosterImage(canvas, filePath).then(resolve).catch(reject);
        },
        fail: () => reject(new Error('poster wxacode write failed')),
      });
    });
  }

  const base64 = uni.arrayBufferToBase64(buffer);
  return loadPosterImage(canvas, `data:image/png;base64,${base64}`);
}

export async function loadPosterImages(
  canvas: PosterCanvasNode,
  payload: PosterPayload,
): Promise<PosterImageMap> {
  const urls = new Set<string>();
  for (const day of payload.days) {
    for (const url of day.highlightImages) {
      urls.add(url);
    }
    for (const item of day.items) {
      if (item.imageUrl) urls.add(item.imageUrl);
    }
  }

  const map: PosterImageMap = new Map();
  await Promise.all(
    [...urls].map(async (url) => {
      try {
        const image = await loadPosterImage(canvas, url);
        map.set(url, image);
      } catch {
        /* 单张失败不影响整图 */
      }
    }),
  );
  return map;
}

/**
 * 从服务端拉取路线分享小程序码并写入 imageMap（海报扫码直达小程序的首选来源）。
 *
 * @param canvas - 海报 Canvas 节点（用于 `createImage`）
 * @param routeId - 已发布路线 ID
 * @param imageMap - 写入目标；成功时设置 `POSTER_WXACODE_KEY`
 * @returns void；失败时静默跳过，由上层改用 URL Link / H5
 */
export async function loadPosterWxacode(
  canvas: PosterCanvasNode,
  routeId: number,
  imageMap: PosterImageMap,
): Promise<void> {
  const url = `${getApiBaseUrl()}/share/routes/${routeId}/wxacode`;

  try {
    await new Promise<void>((resolve) => {
      uni.request({
        url,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: 15000,
        header: {
          'Accept-Language': getApiAcceptLanguage(),
        },
        success: async (res) => {
          if (res.statusCode !== 200 || !isArrayBufferLike(res.data)) {
            resolve();
            return;
          }
          try {
            const image = await loadPosterImageFromBuffer(canvas, res.data, routeId);
            imageMap.set(POSTER_WXACODE_KEY, image);
          } catch {
            /* 小程序码加载失败不影响整图 */
          }
          resolve();
        },
        fail: () => resolve(),
      });
    });
  } catch {
    /* 小程序码加载失败不影响整图 */
  }
}
