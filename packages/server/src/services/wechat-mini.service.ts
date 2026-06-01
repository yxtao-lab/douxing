/**
 * 微信小程序 code 换 openid、access_token、分享小程序码
 */

interface WechatMiniCredentials {
  appId: string;
  secret: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function getWechatMiniCredentials(): WechatMiniCredentials | null {
  const appId = process.env.WECHAT_PAY_APP_ID || process.env.MP_WEIXIN_APPID;
  const secret = process.env.WECHAT_MINI_APP_SECRET;
  if (!appId || !secret) return null;
  return { appId, secret };
}

function resolveWxacodeEnvVersion(): 'develop' | 'trial' | 'release' {
  const fromEnv = process.env.WECHAT_MINI_ENV_VERSION?.trim();
  if (fromEnv === 'develop' || fromEnv === 'trial' || fromEnv === 'release') {
    return fromEnv;
  }
  if (process.env.NODE_ENV === 'production') return 'release';
  return 'develop';
}

export async function exchangeWxCodeForOpenid(wxCode: string): Promise<{ openid: string } | { error: string }> {
  const creds = getWechatMiniCredentials();
  if (!creds) {
    return { error: '未配置小程序 AppSecret（WECHAT_MINI_APP_SECRET）' };
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', creds.appId);
  url.searchParams.set('secret', creds.secret);
  url.searchParams.set('js_code', wxCode);
  url.searchParams.set('grant_type', 'authorization_code');

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      openid?: string;
      errcode?: number;
      errmsg?: string;
    };
    if (data.errcode || !data.openid) {
      return { error: data.errmsg || '微信登录失败' };
    }
    return { openid: data.openid };
  } catch (err) {
    console.error('[wechat-mini] jscode2session', err);
    return { error: '微信登录服务不可用' };
  }
}

export async function getWechatAccessToken(): Promise<string | null> {
  const creds = getWechatMiniCredentials();
  if (!creds) return null;

  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
  url.searchParams.set('grant_type', 'client_credential');
  url.searchParams.set('appid', creds.appId);
  url.searchParams.set('secret', creds.secret);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    };
    if (data.errcode || !data.access_token) {
      console.error('[wechat-mini] getAccessToken', data);
      return null;
    }
    cachedAccessToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    };
    return cachedAccessToken.token;
  } catch (err) {
    console.error('[wechat-mini] getAccessToken', err);
    return null;
  }
}

/** 路线分享页小程序码（scene: id=123） */
export async function createRouteShareWxacode(routeId: number): Promise<Buffer | null> {
  const token = await getWechatAccessToken();
  if (!token) return null;

  const apiUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${token}`;
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scene: `id=${routeId}`,
        page: 'pages/share/route',
        width: 280,
        check_path: false,
        env_version: resolveWxacodeEnvVersion(),
      }),
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const err = (await res.json()) as { errcode?: number; errmsg?: string };
      console.error('[wechat-mini] getwxacodeunlimit', err);
      return null;
    }

    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    console.error('[wechat-mini] getwxacodeunlimit', err);
    return null;
  }
}

/** 路线分享 URL Link（供海报标准 QR 兜底，微信内可打开小程序） */
export async function createRouteShareUrlLink(routeId: number): Promise<string | null> {
  const token = await getWechatAccessToken();
  if (!token) return null;

  const apiUrl = `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${token}`;
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'pages/share/route',
        query: `id=${routeId}`,
        env_version: resolveWxacodeEnvVersion(),
      }),
    });
    const data = (await res.json()) as {
      url_link?: string;
      errcode?: number;
      errmsg?: string;
    };
    if (data.errcode || !data.url_link) {
      console.error('[wechat-mini] generate_urllink', data);
      return null;
    }
    return data.url_link;
  } catch (err) {
    console.error('[wechat-mini] generate_urllink', err);
    return null;
  }
}
