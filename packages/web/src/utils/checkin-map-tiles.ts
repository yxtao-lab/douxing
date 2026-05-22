import L from 'leaflet';

/** 高德路网瓦片（GCJ-02，国内可访问；打卡坐标来自微信 gcj02） */
export function createCheckInTileLayer() {
  return L.tileLayer(
    'https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
    {
      subdomains: ['1', '2', '3', '4'],
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
  const amap = createCheckInTileLayer();
  amap.addTo(map);

  amap.on('tileerror', () => {
    if (map.hasLayer(amap)) {
      map.removeLayer(amap);
      createOsmTileLayer().addTo(map);
    }
  });

  return amap;
}
