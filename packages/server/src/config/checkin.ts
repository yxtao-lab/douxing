function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase().replace(/^["']|["']$/g, '');
  if (['false', '0', 'off', 'no', 'disabled'].includes(normalized)) return false;
  if (['true', '1', 'on', 'yes', 'enabled'].includes(normalized)) return true;
  return defaultValue;
}

/** 打卡地理围栏是否启用（开发可设 CHECKIN_GEOFENCE_ENABLED=false 跳过距离/精度/速度校验） */
export function isCheckinGeofenceEnabled() {
  return parseEnvBoolean(process.env.CHECKIN_GEOFENCE_ENABLED, true);
}

export function getCheckinConfigSummary() {
  return {
    geofenceEnabled: isCheckinGeofenceEnabled(),
    rawGeofenceEnv: process.env.CHECKIN_GEOFENCE_ENABLED ?? null,
  };
}
