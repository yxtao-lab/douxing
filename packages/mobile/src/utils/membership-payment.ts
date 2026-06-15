import type { OrderInfo } from '@douxing/shared';
import { createMembershipOrder } from '@/api/membership';
import { continuePayForOrder, isMpWeixin } from '@/utils/order-payment';
import { i18n } from '@/i18n';

/**
 * 会员升级完整支付：创建订单 → 预下单 → 调起支付（微信或模拟）
 */
export async function completeMembershipUpgradePayment(targetLevel: number): Promise<OrderInfo> {
  const order = await createMembershipOrder(targetLevel);
  return continuePayForOrder(order.id);
}

/** 升级按钮文案 */
export function getMembershipPayButtonLabel(): string {
  if (isMpWeixin()) return String(i18n.global.t('membership.upgradePayWechat'));
  return String(i18n.global.t('membership.upgradePayMock'));
}
