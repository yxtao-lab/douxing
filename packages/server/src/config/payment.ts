import { PaymentChannel } from '@douxing/shared';

export type PaymentMode = 'mock' | 'wechat' | 'auto';

export function getPaymentMode(): PaymentMode {
  const raw = process.env.PAYMENT_MODE?.toLowerCase();
  if (raw === 'mock' || raw === 'wechat') return raw;
  return 'auto';
}

export function isWechatPayConfigured(): boolean {
  return !!(
    process.env.WECHAT_PAY_MCH_ID &&
    process.env.WECHAT_PAY_APP_ID &&
    process.env.WECHAT_PAY_API_V3_KEY &&
    process.env.WECHAT_PAY_SERIAL_NO &&
    process.env.WECHAT_PAY_PRIVATE_KEY_PATH &&
    process.env.WECHAT_PAY_NOTIFY_URL &&
    process.env.WECHAT_MINI_APP_SECRET
  );
}

/** 根据配置与是否提供 wxCode 决定支付渠道 */
export function resolvePaymentChannel(wxCode?: string): typeof PaymentChannel.MOCK | typeof PaymentChannel.WECHAT_JSAPI {
  const mode = getPaymentMode();
  if (mode === 'mock') return PaymentChannel.MOCK;
  if (mode === 'wechat') {
    if (!isWechatPayConfigured()) {
      throw new Error('未配置微信支付，请检查环境变量');
    }
    if (!wxCode) {
      throw new Error('请在微信小程序内完成支付');
    }
    return PaymentChannel.WECHAT_JSAPI;
  }
  if (isWechatPayConfigured() && wxCode) {
    return PaymentChannel.WECHAT_JSAPI;
  }
  return PaymentChannel.MOCK;
}
