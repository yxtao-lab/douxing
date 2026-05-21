import { OrderStatus, PaymentChannel } from '@douxing/shared';
import type { OrderPrepayResult } from '@douxing/shared';
import { resolvePaymentChannel } from '../config/payment.js';
import { exchangeWxCodeForOpenid } from './wechat-mini.service.js';
import { createWechatJsapiPrepay } from './wechat-pay.service.js';
import { findUserOrder, fulfillOrderAfterPaid, getOrderByOrderNo } from './order.service.js';
import { getWechatPayClient } from './wechat-pay.service.js';

export async function createOrderPrepay(
  orderId: number,
  userId: number,
  wxCode?: string,
): Promise<{ prepay: OrderPrepayResult } | { error: string }> {
  const orderResult = await findUserOrder(orderId, userId);
  if (!orderResult) return { error: '订单不存在' };
  const order = orderResult;

  if (order.status !== OrderStatus.PENDING) {
    return { error: '仅待支付订单可发起支付' };
  }

  let channel: typeof PaymentChannel.MOCK | typeof PaymentChannel.WECHAT_JSAPI;
  try {
    channel = resolvePaymentChannel(wxCode);
  } catch (e) {
    return { error: e instanceof Error ? e.message : '支付渠道不可用' };
  }

  const base: OrderPrepayResult = {
    channel,
    orderId: order.id,
    orderNo: order.orderNo,
    totalAmount: order.totalAmount,
  };

  if (channel === PaymentChannel.MOCK) {
    return { prepay: base };
  }

  if (!wxCode) {
    return { error: '微信小程序支付需要 wxCode' };
  }

  const session = await exchangeWxCodeForOpenid(wxCode);
  if ('error' in session) return { error: session.error };

  const wxPrepay = await createWechatJsapiPrepay({
    description: order.productName,
    outTradeNo: order.orderNo,
    totalAmountYuan: order.totalAmount,
    openid: session.openid,
  });
  if ('error' in wxPrepay) return { error: wxPrepay.error };

  return {
    prepay: {
      ...base,
      wechat: wxPrepay.params,
    },
  };
}

export async function handleWechatPayNotify(rawBody: string, headers: Record<string, string | string[] | undefined>) {
  const pay = getWechatPayClient();
  if (!pay) {
    return { status: 500, body: { code: 'FAIL', message: '支付未配置' } };
  }

  const timestamp = String(headers['wechatpay-timestamp'] ?? '');
  const nonce = String(headers['wechatpay-nonce'] ?? '');
  const serial = String(headers['wechatpay-serial'] ?? '');
  const signature = String(headers['wechatpay-signature'] ?? '');

  try {
    const verified = await pay.verifySign({
      timestamp,
      nonce,
      body: rawBody,
      serial,
      signature,
    });
    if (!verified) {
      return { status: 401, body: { code: 'FAIL', message: '验签失败' } };
    }

    const payload = JSON.parse(rawBody) as {
      resource?: {
        ciphertext: string;
        associated_data: string;
        nonce: string;
      };
    };
    if (!payload.resource) {
      return { status: 400, body: { code: 'FAIL', message: '无效通知' } };
    }

    const decrypted = pay.decipher_gcm<{
      trade_state?: string;
      out_trade_no?: string;
      amount?: { total?: number };
    }>(
      payload.resource.ciphertext,
      payload.resource.associated_data,
      payload.resource.nonce,
    );

    if (decrypted.trade_state !== 'SUCCESS' || !decrypted.out_trade_no) {
      return { status: 200, body: { code: 'SUCCESS', message: '已忽略' } };
    }

    const orderRow = await getOrderByOrderNo(decrypted.out_trade_no);
    if (!orderRow) {
      return { status: 200, body: { code: 'SUCCESS', message: '订单不存在' } };
    }

    const expectedFen = Math.round(parseFloat(String(orderRow.totalAmount)) * 100);
    if (decrypted.amount?.total != null && decrypted.amount.total !== expectedFen) {
      console.error('[wechat-pay] 金额不一致', decrypted.out_trade_no, decrypted.amount.total, expectedFen);
      return { status: 400, body: { code: 'FAIL', message: '金额不一致' } };
    }

    const result = await fulfillOrderAfterPaid(orderRow.id);
    if ('error' in result) {
      console.error('[wechat-pay] 履约失败', result.error, orderRow.id);
    }

    return { status: 200, body: { code: 'SUCCESS', message: '成功' } };
  } catch (err) {
    console.error('[wechat-pay] notify', err);
    return { status: 500, body: { code: 'FAIL', message: '处理失败' } };
  }
}
