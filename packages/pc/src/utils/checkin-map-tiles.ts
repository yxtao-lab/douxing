import L from 'leaflet';

const GAODE_SUBDOMAINS = ['1', '2', '3', '4'] as const;

/** 高德矢量底图（无路网注记；GCJ-02） */
export function createCheckInBaseTileLayer() {
  return L.tileLayer(
    'https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=2&style=7',
    {
      subdomains: [...GAODE_SUBDOMAINS],
      maxZoom: 18,
    },
  );
}

/** 高德注记层（城市、道路名称；须叠在底图之上） */
export function createCheckInLabelTileLayer() {
  return L.tileLayer(
    'https://wprd0{s}.is.autonavi.com/appmaptile?x={x}&y={y}&z={z}&lang=zh_cn&size=1&scl=1&style=7',
    {
      subdomains: [...GAODE_SUBDOMAINS],
      maxZoom: 18,
      pane: 'overlayPane',
      attribution: '&copy; 高德地图',
    },
  );
}

/** 高德路网详图（单图层降级方案） */
export function createCheckInTileLayer() {
  return L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: [...GAODE_SUBDOMAINS],
      maxZoom: 18,
      attribution: '&copy; 高德地图',
    },
  );
}

/** OpenStreetMap 备用（海外或高德不可用时） */
export function createOsmTileLayer() {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  });
}

export function mountCheckInTileLayer(map: L.Map) {
  const base = createCheckInBaseTileLayer();
  const labels = createCheckInLabelTileLayer();
  base.addTo(map);
  labels.addTo(map);

  let fallbackApplied = false;

  function applyFallback() {
    if (fallbackApplied) return;
    fallbackApplied = true;
    if (map.hasLayer(base)) map.removeLayer(base);
    if (map.hasLayer(labels)) map.removeLayer(labels);
    createCheckInTileLayer().addTo(map);
  }

  base.on('tileerror', applyFallback);
  labels.on('tileerror', applyFallback);

  return base;
}
