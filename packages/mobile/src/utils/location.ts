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
      success: (res) => resolve((res.authSetting ?? {}) as AuthSetting),
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
      title: '需要定位权限',
      content: '打卡需获取您的位置，以验证是否在景点 500 米范围内。请在设置中开启「位置信息」。',
      confirmText: '去设置',
      cancelText: '取消',
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
  if (!wxApi?.requirePrivacyAuthorize) return;

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
    throw new Error('请先同意小程序隐私协议后再打卡');
  }

  const auth = await getAuthSetting();
  if (auth['scope.userLocation'] === true) return;

  if (auth['scope.userLocation'] === false) {
    const opened = await promptOpenSettings();
    if (!opened) {
      throw new Error('定位权限未开启，无法完成打卡');
    }
    return;
  }

  const authorized = await requestLocationAuthorize();
  if (authorized) return;

  const opened = await promptOpenSettings();
  if (!opened) {
    throw new Error('定位权限未开启，无法完成打卡');
  }
}

function mapLocationError(errMsg: string) {
  const msg = errMsg.toLowerCase();

  if (msg.includes('privacy') || msg.includes('api scope is not declared')) {
    return '小程序未声明定位能力，请重新编译并在微信公众平台配置隐私协议';
  }
  if (
    msg.includes('auth deny') ||
    msg.includes('authorize') ||
    msg.includes('permission denied') ||
    msg.includes('scope unauthorized')
  ) {
    return '定位权限未开启，请在设置中允许「位置信息」';
  }
  if (msg.includes('locationswitchoff') || msg.includes('gps') || msg.includes('location services')) {
    return '请打开手机系统定位/GPS 后重试';
  }
  if (msg.includes('timeout') || msg.includes('timed out')) {
    return '定位超时，请到开阔处后重试';
  }

  try {
    const info = uni.getSystemInfoSync();
    if (info.platform === 'devtools') {
      return '开发者工具请开启模拟定位：工具栏「位置」选择坐标，或使用真机预览';
    }
  } catch {
    // ignore
  }

  return '获取定位失败，请检查定位权限与 GPS 是否开启';
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
          accuracy: res.accuracy ?? 999,
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
