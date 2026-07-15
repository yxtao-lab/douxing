import { ServiceOrderStatus, type ServiceOrderDetail, type WechatJsapiPayParams } from '@douxing/shared';
import {
  createMarketplaceOrderPrepay,
  fetchMarketplaceOrderById,
  payMarketplaceOrder,
} from '@/api/marketplace';
import { i18n } from '@/i18n';
import { isMpWeixin } from '@/utils/order-payment';

const PAYMENT_POLL_INTERVAL_MS = 1500;
const PAYMENT_POLL_MAX_ATTEMPTS = 40;

/**
 * 获取微信小程序登录 code。
 *
 * @returns `wx.login` 返回的 code
 * @throws 登录失败时抛出带 i18n 文案的 Error
 */
async function getWxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (res.code) resolve(res.code);
        else reject(new Error(String(i18n.global.t('orders.wxLoginFailed'))));
      },
      fail: (err) => reject(new Error(err.errMsg || String(i18n.global.t('orders.wxLoginFailed')))),
    });
  });
}

/**
 * 调起微信 JSAPI 支付。
 *
 * @param params - 预下单返回的微信调起参数
 * @returns 支付成功时 resolve；取消或失败时 reject
 */
function invokeWechatPayment(params: WechatJsapiPayParams): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: 'wxpay',
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: () => resolve(),
      fail: (err) => {
        const msg = err.errMsg || '';
        if (msg.includes('cancel')) {
          reject(new Error(String(i18n.global.t('routes.payCancelled'))));
        } else {
          reject(new Error(msg || String(i18n.global.t('routes.payFailed'))));
        }
      },
    });
  });
}

/**
 * 判断服务订单是否已支付成功（含后续履约态）。
 *
 * @param status - 订单状态
 * @returns 已支付及之后为 true
 */
function isServiceOrderPaid(status: string): boolean {
  return (
    status === ServiceOrderStatus.PAID ||
    status === ServiceOrderStatus.IN_PROGRESS ||
    status === ServiceOrderStatus.DELIVERED ||
    status === ServiceOrderStatus.CONFIRMED ||
    status === ServiceOrderStatus.SETTLED
  );
}

/**
 * 微信支付成功后轮询服务订单状态（等待异步回调履约）。
 *
 * @param orderId - 服务订单 ID
 * @returns 已支付后的订单详情
 * @throws 超时未确认时抛出
 */
async function pollServiceOrderPaid(orderId: number): Promise<ServiceOrderDetail> {
  for (let i = 0; i < PAYMENT_POLL_MAX_ATTEMPTS; i += 1) {
    const order = await fetchMarketplaceOrderById(orderId);
    if (isServiceOrderPaid(order.status)) return order;
    await new Promise((r) => setTimeout(r, PAYMENT_POLL_INTERVAL_MS));
  }
  throw new Error(String(i18n.global.t('orders.payPendingConfirm')));
}

/**
 * 服务订单支付：预下单 → mock 确认或微信 JSAPI → 轮询履约。
 *
 * @param orderId - 待支付订单 ID
 * @returns 支付成功后的订单详情
 */
export async function completeMarketplaceOrderPayment(orderId: number): Promise<ServiceOrderDetail> {
  let wxCode: string | undefined;
  if (isMpWeixin()) {
    try {
      wxCode = await getWxLoginCode();
    } catch {
      // 预下单时服务端可能降级为 mock
    }
  }

  const prepay = await createMarketplaceOrderPrepay(orderId, wxCode ? { wxCode } : undefined);

  if (prepay.channel === 'mock') {
    return payMarketplaceOrder(orderId);
  }

  if (!prepay.wechat) {
    throw new Error(String(i18n.global.t('orders.wechatPayParamsMissing')));
  }

  await invokeWechatPayment(prepay.wechat);
  return pollServiceOrderPaid(orderId);
}

/**
 * 服务订单支付按钮文案（微信小程序 vs 模拟）。
 *
 * @returns i18n 文案
 */
export function getMarketplacePayButtonLabel(): string {
  if (isMpWeixin()) return String(i18n.global.t('marketplace.payWechat'));
  return String(i18n.global.t('marketplace.payMock'));
}
