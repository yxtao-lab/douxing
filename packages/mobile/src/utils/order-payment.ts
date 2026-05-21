import { OrderStatus, type OrderInfo, type WechatJsapiPayParams } from '@douxing/shared';
import { createUnlockOrder, createOrderPrepay, payOrder, fetchOrderById } from '@/api/orders';

const PAYMENT_POLL_INTERVAL_MS = 1500;
const PAYMENT_POLL_MAX_ATTEMPTS = 40;

/** 是否微信小程序运行环境 */
export function isMpWeixin(): boolean {
  // #ifdef MP-WEIXIN
  return true;
  // #endif
  return false;
}

async function getWxLoginCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: 'weixin',
      success: (res) => {
        if (res.code) resolve(res.code);
        else reject(new Error('微信登录失败，请重试'));
      },
      fail: (err) => reject(new Error(err.errMsg || '微信登录失败')),
    });
  });
}

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
          reject(new Error('已取消支付'));
        } else {
          reject(new Error(msg || '微信支付失败'));
        }
      },
    });
  });
}

function isOrderFulfilled(status: number): boolean {
  return status === OrderStatus.PAID || status === OrderStatus.COMPLETED;
}

/** 微信支付成功后轮询订单状态（等待异步回调履约） */
async function pollOrderFulfilled(orderId: number): Promise<OrderInfo> {
  for (let i = 0; i < PAYMENT_POLL_MAX_ATTEMPTS; i += 1) {
    const order = await fetchOrderById(orderId);
    if (isOrderFulfilled(order.status)) return order;
    await new Promise((r) => setTimeout(r, PAYMENT_POLL_INTERVAL_MS));
  }
  throw new Error('支付结果确认中，请稍后下拉刷新查看');
}

/** 已有待支付订单：预下单 → 调起支付（订单列表「继续支付」） */
export async function continuePayForOrder(orderId: number): Promise<OrderInfo> {
  let wxCode: string | undefined;
  if (isMpWeixin()) {
    try {
      wxCode = await getWxLoginCode();
    } catch {
      // 预下单时服务端可能降级为 mock
    }
  }

  const prepay = await createOrderPrepay(orderId, wxCode ? { wxCode } : undefined);

  if (prepay.channel === 'mock') {
    return payOrder(orderId);
  }

  if (!prepay.wechat) {
    throw new Error('微信支付参数缺失');
  }

  await invokeWechatPayment(prepay.wechat);
  return pollOrderFulfilled(orderId);
}

/**
 * 路线解锁完整支付：创建订单 → 预下单 → 调起支付（微信或模拟）
 */
export async function completeRouteUnlockPayment(routeId: number): Promise<OrderInfo> {
  const order = await createUnlockOrder(routeId);
  return continuePayForOrder(order.id);
}

/** 解锁按钮文案 */
export function getUnlockPayButtonLabel(): string {
  if (isMpWeixin()) return '微信支付解锁';
  return '解锁路线（模拟支付）';
}

/** 继续支付按钮文案 */
export function getContinuePayButtonLabel(): string {
  if (isMpWeixin()) return '继续支付';
  return '继续支付（模拟）';
}
