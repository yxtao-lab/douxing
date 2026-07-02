import {
  getWikimediaErrorCacheTtlSec,
  getWikimediaFetchTimeoutMs,
  getWikimediaMissCacheTtlSec,
  isWikimediaImageEnrichEnabled,
} from '../config/oss.js';

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'DouxingTravel/1.0 (attraction cover enricher; contact@douxing.app)';
const NEGATIVE_CACHE_MAX_ENTRIES = 1000;

export interface WikimediaCoverResult {
  imageUrl: string;
  title: string;
  license: string;
  attribution: string;
}

interface WikimediaPage {
  title?: string;
  imageinfo?: Array<{
    url?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
}

interface WikimediaApiResponse {
  query?: {
    pages?: Record<string, WikimediaPage>;
  };
}

/** 负缓存：景点名+城市 → 过期时间戳（毫秒） */
const negativeCache = new Map<string, number>();

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

function buildAttribution(title: string, meta: Record<string, { value?: string }>): string {
  const artist = meta.Artist?.value ? stripHtml(meta.Artist.value) : '';
  const credit = meta.Credit?.value ? stripHtml(meta.Credit.value) : '';
  const license = meta.LicenseShortName?.value?.trim() || 'Wikimedia Commons';

  const parts = ['Wikimedia Commons'];
  if (title) parts.push(title.replace(/^File:/, ''));
  if (artist) parts.push(artist);
  if (credit && credit !== artist) parts.push(credit);
  parts.push(license);
  return parts.join(' · ');
}

/**
 * 构建 Wikimedia 负缓存键（景点名 + 城市，小写归一化）。
 *
 * @param name - 景点名称
 * @param city - 城市名
 * @returns 进程内 Map 键
 */
function buildNegativeCacheKey(name: string, city: string): string {
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}

/**
 * 判断景点是否处于负缓存有效期内。
 *
 * @param cacheKey - `buildNegativeCacheKey` 生成的键
 * @returns 未过期时为 `true`
 */
function isNegativeCached(cacheKey: string): boolean {
  const expiresAt = negativeCache.get(cacheKey);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    negativeCache.delete(cacheKey);
    return false;
  }
  return true;
}

/**
 * 写入负缓存；超出容量时淘汰最早条目。
 *
 * @param cacheKey - 缓存键
 * @param ttlSec - 有效秒数
 * @returns `void`
 */
function setNegativeCache(cacheKey: string, ttlSec: number): void {
  if (negativeCache.size >= NEGATIVE_CACHE_MAX_ENTRIES && !negativeCache.has(cacheKey)) {
    const oldestKey = negativeCache.keys().next().value;
    if (oldestKey) negativeCache.delete(oldestKey);
  }
  negativeCache.set(cacheKey, Date.now() + ttlSec * 1000);
}

/**
 * 带超时的 fetch，避免 commons.wikimedia.org 长时间挂起。
 *
 * @param url - 完整请求 URL
 * @param timeoutMs - 超时毫秒数
 * @returns HTTP 响应
 * @throws 超时或网络失败时抛出 Error
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Wikimedia API 超时（${timeoutMs}ms）`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 调用 Wikimedia Commons API 并解析 JSON。
 *
 * @param params - MediaWiki API 查询参数
 * @returns 解析后的响应体
 * @throws HTTP 非 2xx、超时或 JSON 解析失败时抛出
 */
async function fetchWikimediaApi(params: Record<string, string>): Promise<WikimediaApiResponse> {
  const search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const timeoutMs = getWikimediaFetchTimeoutMs();
  const res = await fetchWithTimeout(`${WIKIMEDIA_API}?${search}`, timeoutMs);
  if (!res.ok) {
    throw new Error(`Wikimedia API HTTP ${res.status}`);
  }
  return (await res.json()) as WikimediaApiResponse;
}

/**
 * 从 API 返回的 pages 中挑选首个合规 CC 封面图。
 *
 * @param pages - Wikimedia query.pages
 * @returns 封面结果；无合适图片时为 `null`
 */
function pickBestImage(pages: Record<string, WikimediaPage> | undefined): WikimediaCoverResult | null {
  if (!pages) return null;

  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    const url = info?.url?.trim();
    if (!info || !url || !/^https?:\/\//i.test(url)) continue;

    const meta = info.extmetadata ?? {};
    const license = meta.LicenseShortName?.value?.trim() || 'CC';
    const title = page.title?.trim() || '';

    const licenseLower = license.toLowerCase();
    if (licenseLower.includes('non-free') || licenseLower === 'unknown') {
      continue;
    }

    return {
      imageUrl: url,
      title,
      license: `wikimedia_${license.replace(/\s+/g, '_').toLowerCase()}`,
      attribution: buildAttribution(title, meta),
    };
  }

  return null;
}

/**
 * 按景点名 + 城市在 Wikimedia Commons 搜索可用封面图。
 *
 * @param name - 景点名称
 * @param city - 城市名
 * @returns 封面 URL 与版权信息；未启用、负缓存、无图或失败时为 `null`
 */
export async function fetchWikimediaCoverImage(
  name: string,
  city: string,
): Promise<WikimediaCoverResult | null> {
  if (!isWikimediaImageEnrichEnabled()) return null;

  const trimmedName = name.trim();
  const trimmedCity = city.trim();
  if (!trimmedName) return null;

  const cacheKey = buildNegativeCacheKey(trimmedName, trimmedCity);
  if (isNegativeCached(cacheKey)) return null;

  const queries = [
    `${trimmedName} ${trimmedCity}`.trim(),
    trimmedName,
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

  let hadFetchError = false;

  for (const gsrsearch of queries) {
    try {
      const data = await fetchWikimediaApi({
        action: 'query',
        generator: 'search',
        gsrsearch,
        gsrnamespace: '6',
        gsrlimit: '5',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata',
        iiurlwidth: '1024',
      });

      const picked = pickBestImage(data.query?.pages);
      if (picked) return picked;
    } catch (err) {
      hadFetchError = true;
      console.warn(
        '[wikimedia-cover] 搜索失败:',
        gsrsearch,
        err instanceof Error ? err.message : err,
      );
      setNegativeCache(cacheKey, getWikimediaErrorCacheTtlSec());
      break;
    }
  }

  if (hadFetchError) {
    setNegativeCache(cacheKey, getWikimediaErrorCacheTtlSec());
  } else {
    setNegativeCache(cacheKey, getWikimediaMissCacheTtlSec());
  }

  return null;
}
