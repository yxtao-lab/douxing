import { mobileT } from '@/i18n/mobileT';

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

type AuthSetting = Record<string, boolean | undefined>;

type WxPrivacyApi = {
  requirePrivacyAuthorize?: (options: {
    success: () => void;
    fail: (err: { errMsg?: string }) => void;
  }) => void;
};

function getWxApi(): WxPrivacyApi | undefined {
  return (globalThis as { wx?: WxPrivacyApi }).wx;
}

function getAuthSetting(): Promise<AuthSetting> {
  return new Promise((resolve) => {
    uni.getSetting({
      success: (res) => resolve((res.authSetting || {}) as AuthSetting),
      fail: () => resolve({}),
    });
  });
}

function requestLocationAuthorize(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.userLocation',
      success: () => resolve(true),
      fail: () => resolve(false),
    });
  });
}

function promptOpenSettings(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: mobileT('location.permissionTitle'),
      content: mobileT('location.permissionContent'),
      confirmText: mobileT('common.goSettings'),
      cancelText: mobileT('common.cancel'),
      success: (modalRes) => {
        if (!modalRes.confirm) {
          resolve(false);
          return;
        }
        uni.openSetting({
          success: (settingRes) => {
            resolve(settingRes.authSetting['scope.userLocation'] === true);
          },
          fail: () => resolve(false),
        });
      },
      fail: () => resolve(false),
    });
  });
}

async function requirePrivacyAuthorizeIfNeeded() {
  const wxApi = getWxApi();
  if (!wxApi || !wxApi.requirePrivacyAuthorize) return;

  await new Promise<void>((resolve, reject) => {
    wxApi.requirePrivacyAuthorize!({
      success: () => resolve(),
      fail: (err) => reject(new Error(err.errMsg || 'privacy authorize fail')),
    });
  });
}

async function ensureLocationPermission() {
  try {
    await requirePrivacyAuthorizeIfNeeded();
  } catch {
    throw new Error(mobileT('location.privacyRequired'));
  }

  const auth = await getAuthSetting();
  if (auth['scope.userLocation'] === true) return;

  if (auth['scope.userLocation'] === false) {
    const opened = await promptOpenSettings();
    if (!opened) {
      throw new Error(mobileT('location.permissionDenied'));
    }
    return;
  }

  const authorized = await requestLocationAuthorize();
  if (authorized) return;

  const opened = await promptOpenSettings();
  if (!opened) {
    throw new Error(mobileT('location.permissionDenied'));
  }
}

function mapLocationError(errMsg: string) {
  const msg = errMsg.toLowerCase();

  if (msg.includes('privacy') || msg.includes('api scope is not declared')) {
    return mobileT('location.capabilityMissing');
  }
  if (
    msg.includes('auth deny') ||
    msg.includes('authorize') ||
    msg.includes('permission denied') ||
    msg.includes('scope unauthorized')
  ) {
    return mobileT('location.settingsRequired');
  }
  if (msg.includes('locationswitchoff') || msg.includes('gps') || msg.includes('location services')) {
    return mobileT('location.gpsDisabled');
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return mobileT('location.timeout');
  }

  try {
    const info = uni.getSystemInfoSync();
    if (info.platform === 'devtools') {
      return mobileT('location.devtoolsHint');
    }
  } catch {
    // ignore
  }

  return mobileT('location.failed');
}

function fetchLocation(isHighAccuracy: boolean): Promise<CurrentLocation> {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy,
      highAccuracyExpireTime: isHighAccuracy ? 5000 : undefined,
      success: (res) => {
        resolve({
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy != null ? res.accuracy : 999,
        });
      },
      fail: (err) => {
        reject(new Error(mapLocationError(err.errMsg || 'getLocation fail')));
      },
    });
  });
}

/** 获取当前 GPS 位置（gcj02，与高德/微信地图一致） */
export async function getCurrentLocation(): Promise<CurrentLocation> {
  await ensureLocationPermission();

  try {
    return await fetchLocation(true);
  } catch (highAccuracyErr) {
    try {
      return await fetchLocation(false);
    } catch {
      throw highAccuracyErr;
    }
  }
}
