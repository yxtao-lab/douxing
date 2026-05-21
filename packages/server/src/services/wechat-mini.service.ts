/**
 * 微信小程序 code 换 openid
 */
export async function exchangeWxCodeForOpenid(wxCode: string): Promise<{ openid: string } | { error: string }> {
  const appId = process.env.WECHAT_PAY_APP_ID || process.env.MP_WEIXIN_APPID;
  const secret = process.env.WECHAT_MINI_APP_SECRET;
  if (!appId || !secret) {
    return { error: '未配置小程序 AppSecret（WECHAT_MINI_APP_SECRET）' };
  }

  const url = new URL('https://api.weixin.qq.com/sns/jscode2session');
  url.searchParams.set('appid', appId);
  url.searchParams.set('secret', secret);
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
