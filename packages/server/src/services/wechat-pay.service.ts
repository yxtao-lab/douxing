import { readFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import WxPay from 'wechatpay-node-v3';
import type { WechatJsapiPayParams } from '@douxing/shared';
import { isWechatPayConfigured } from '../config/payment.js';

let payClient: WxPay | null | undefined;

function loadPayClient(): WxPay | null {
  if (payClient !== undefined) return payClient;
  if (!isWechatPayConfigured()) {
    payClient = null;
    return null;
  }

  const privateKeyPath = process.env.WECHAT_PAY_PRIVATE_KEY_PATH!;
  const publicKeyPath = process.env.WECHAT_PAY_PUBLIC_KEY_PATH;
  if (!existsSync(privateKeyPath)) {
    console.warn('[wechat-pay] 商户私钥文件不存在:', privateKeyPath);
    payClient = null;
    return null;
  }

  const privateKey = readFileSync(privateKeyPath);
  const publicKey = publicKeyPath && existsSync(publicKeyPath)
    ? readFileSync(publicKeyPath)
    : privateKey;

  payClient = new WxPay({
    appid: process.env.WECHAT_PAY_APP_ID!,
    mchid: process.env.WECHAT_PAY_MCH_ID!,
    publicKey,
    privateKey,
    key: process.env.WECHAT_PAY_API_V3_KEY!,
    serial_no: process.env.WECHAT_PAY_SERIAL_NO!,
  });
  return payClient;
}

export function getWechatPayClient(): WxPay | null {
  return loadPayClient();
}

function randomNonce(): string {
  return randomBytes(16).toString('hex');
}

export async function createWechatJsapiPrepay(params: {
  description: string;
  outTradeNo: string;
  totalAmountYuan: string;
  openid: string;
}): Promise<{ params: WechatJsapiPayParams } | { error: string }> {
  const pay = loadPayClient();
  if (!pay) return { error: '微信支付未配置或证书缺失' };

  const totalFen = Math.round(parseFloat(params.totalAmountYuan) * 100);
  if (totalFen <= 0) return { error: '订单金额无效' };

  try {
    const result = (await pay.transactions_jsapi({
      appid: process.env.WECHAT_PAY_APP_ID!,
      mchid: process.env.WECHAT_PAY_MCH_ID!,
      description: params.description.slice(0, 127),
      out_trade_no: params.outTradeNo,
      notify_url: process.env.WECHAT_PAY_NOTIFY_URL!,
      amount: { total: totalFen, currency: 'CNY' },
      payer: { openid: params.openid },
    })) as { prepay_id?: string };

    const prepayId = result.prepay_id;
    if (!prepayId) return { error: '微信下单失败' };

    const appId = process.env.WECHAT_PAY_APP_ID!;
    const timeStamp = String(Math.floor(Date.now() / 1000));
    const nonceStr = randomNonce();
    const packageStr = `prepay_id=${prepayId}`;
    const paySign = pay.sha256WithRsa(`${appId}\n${timeStamp}\n${nonceStr}\n${packageStr}\n`);

    return {
      params: {
        timeStamp,
        nonceStr,
        package: packageStr,
        signType: 'RSA',
        paySign,
      },
    };
  } catch (err) {
    console.error('[wechat-pay] transactions_jsapi', err);
    return { error: '微信预下单失败' };
  }
}
