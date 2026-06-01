import type { PosterPayload } from './types';

type PosterCanvasNode = HTMLCanvasElement | Record<string, unknown>;

export type PosterImageMap = Map<string, CanvasImageSource>;

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

export async function loadPosterImages(
  canvas: PosterCanvasNode,
  payload: PosterPayload,
): Promise<PosterImageMap> {
  const urls = new Set<string>();
  for (const day of payload.days) {
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
