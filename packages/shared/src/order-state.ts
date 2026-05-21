import { OrderStatus, OrderType } from './constants.js';

/** 待支付订单默认超时（分钟），与设计文档 §5.3 一致 */
export const ORDER_PENDING_TIMEOUT_MINUTES_DEFAULT = 30;

/** MVP 允许的订单状态流转 */
const ORDER_ALLOWED_TRANSITIONS: Record<number, readonly number[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.COMPLETED],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
};

export function canTransitionOrderStatus(from: number, to: number): boolean {
  return ORDER_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isOrderTerminalStatus(status: number): boolean {
  return status === OrderStatus.COMPLETED || status === OrderStatus.CANCELLED;
}

/** 数字类订单支付后可直接完结（路线解锁等） */
export function shouldAutoCompleteAfterPay(orderType: string): boolean {
  return orderType === OrderType.ROUTE;
}

export function getOrderStatusLabel(status: number): string {
  if (status === OrderStatus.PAID) return '已支付';
  if (status === OrderStatus.COMPLETED) return '已完成';
  if (status === OrderStatus.CANCELLED) return '已取消';
  return '待支付';
}
