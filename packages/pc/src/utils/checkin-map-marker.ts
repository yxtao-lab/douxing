import type { CheckInInfo } from '@douxing/shared';
import { formatCheckInTime } from '@douxing/shared';

export interface CheckInMapPopupLabels {
  unknownPlace: string;
  unknownCity: string;
  pointsBadge: string;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 开发环境将绝对地址转为 /uploads 走 Vite 代理 */
export function normalizeMediaUrl(url: string) {
  if (!url) return url;
  if (url.startsWith('/uploads/')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/uploads/')) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // ignore
  }
  return url;
}

export function buildCheckInMarkerHtml(item: CheckInInfo, active: boolean, unknownPlace: string) {
  const activeClass = active ? ' is-active' : '';
  const photo = item.photos[0] ? normalizeMediaUrl(item.photos[0]) : '';

  if (photo) {
    return `
      <div class="checkin-marker${activeClass}">
        <img class="checkin-marker-photo" src="${escapeHtml(photo)}" alt="" />
        <div class="checkin-marker-arrow"></div>
        <div class="checkin-marker-dot"></div>
      </div>`;
  }

  const title = escapeHtml(item.location.placeName || unknownPlace);
  return `
    <div class="checkin-marker checkin-marker--plain${activeClass}">
      <div class="checkin-marker-label">${title}</div>
      <div class="checkin-marker-dot"></div>
    </div>`;
}

export function getMarkerIconSize(item: CheckInInfo) {
  if (item.photos[0]) {
    return { width: 52, height: 72 };
  }
  const titleLen = item.location.placeName?.length ?? 4;
  return { width: Math.min(140, Math.max(52, titleLen * 12 + 24)), height: 40 };
}

export function buildCheckInPopupHtml(item: CheckInInfo, labels: CheckInMapPopupLabels) {
  const title = escapeHtml(item.location.placeName || labels.unknownPlace);
  const city = escapeHtml(item.city || item.cityCode || labels.unknownCity);
  const time = escapeHtml(formatCheckInTime(item.checkedAt));
  const points = escapeHtml(
    labels.pointsBadge.replace('{points}', String(item.pointsEarned)),
  );
  const photo = item.photos[0]
    ? `<img class="checkin-map-popup-photo" src="${escapeHtml(normalizeMediaUrl(item.photos[0]))}" alt="" />`
    : '';

  return `
    <div class="checkin-map-popup">
      <div class="checkin-map-popup-title">${title}</div>
      <div class="checkin-map-popup-meta">${city} · ${time} · ${points}</div>
      ${photo}
    </div>`;
}
