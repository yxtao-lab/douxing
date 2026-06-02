import { isWikimediaImageEnrichEnabled } from '../config/oss.js';

const WIKIMEDIA_API = 'https://commons.wikimedia.org/w/api.php';
const USER_AGENT = 'DouxingTravel/1.0 (attraction cover enricher; contact@douxing.app)';

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

async function fetchWikimediaApi(params: Record<string, string>): Promise<WikimediaApiResponse> {
  const search = new URLSearchParams({ format: 'json', origin: '*', ...params });
  const res = await fetch(`${WIKIMEDIA_API}?${search}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`Wikimedia API HTTP ${res.status}`);
  }
  return (await res.json()) as WikimediaApiResponse;
}

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
 */
export async function fetchWikimediaCoverImage(
  name: string,
  city: string,
): Promise<WikimediaCoverResult | null> {
  if (!isWikimediaImageEnrichEnabled()) return null;

  const trimmedName = name.trim();
  const trimmedCity = city.trim();
  if (!trimmedName) return null;

  const queries = [
    `${trimmedName} ${trimmedCity}`.trim(),
    trimmedName,
  ].filter((q, i, arr) => q && arr.indexOf(q) === i);

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
      console.warn(
        '[wikimedia-cover] 搜索失败:',
        gsrsearch,
        err instanceof Error ? err.message : err,
      );
    }
  }

  return null;
}
