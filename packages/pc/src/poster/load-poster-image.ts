import type { PosterPayload } from './types';
import { AUTH_TOKEN_KEY } from '@douxing/shared';

export type PosterImageMap = Map<string, CanvasImageSource>;

/** imageMap 中小程序码占位 key */
export const POSTER_WXACODE_KEY = '__poster_wxacode__';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function loadPosterImage(url: string): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('poster image load failed'));
    img.src = url;
  });
}

async function loadPosterImageFromBuffer(buffer: ArrayBuffer): Promise<CanvasImageSource> {
  const base64 = arrayBufferToBase64(buffer);
  return loadPosterImage(`data:image/png;base64,${base64}`);
}

export async function loadPosterImages(payload: PosterPayload): Promise<PosterImageMap> {
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
        const image = await loadPosterImage(url);
        map.set(url, image);
      } catch {
        /* 单张失败不影响整图 */
      }
    }),
  );
  return map;
}

/**
 * PC 端拉取路线分享小程序码并写入 imageMap（海报扫码直达小程序的首选来源）。
 *
 * @param routeId - 已发布路线 ID
 * @param imageMap - 写入目标；成功时设置 `POSTER_WXACODE_KEY`
 * @returns void；失败时静默跳过，由上层改用 URL Link / Web 分享页
 */
export async function loadPosterWxacode(
  routeId: number,
  imageMap: PosterImageMap,
): Promise<void> {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    const res = await fetch(`${API_BASE}/share/routes/${routeId}/wxacode`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 0) {
      const image = await loadPosterImageFromBuffer(buffer);
      imageMap.set(POSTER_WXACODE_KEY, image);
    }
  } catch {
    /* 小程序码加载失败不影响整图 */
  }
}
