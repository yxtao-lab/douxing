import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  createRouteUnlockOrder,
  payOrder,
  cancelOrder,
  getOrderById,
  listUserOrders,
  listAllOrdersForAdmin,
} from '../services/order.service.js';
import { createOrderPrepay } from '../services/payment.service.js';
import { getPaymentMode, isWechatPayConfigured } from '../config/payment.js';
import { isRouteUnlockPaymentRequired } from '../config/route-unlock.js';
import { getUserWithRoles } from '../services/user.service.js';
import { RoleCode } from '@douxing/shared';

const router = Router();

const createOrderSchema = z.object({
  routeId: z.number().int().positive(),
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const result = await createRouteUnlockOrder(req.auth!.userId, parsed.data.routeId);
    if ('error' in result) return fail(res, result.error ?? '创建失败');
    success(res, result.order, '订单创建成功');
  } catch (err) {
    console.error('[orders/create]', err);
    return fail(res, '创建订单失败', 500, 500);
  }
});

const prepaySchema = z.object({
  wxCode: z.string().min(1).optional(),
});

router.get('/payment-config', authMiddleware, async (_req, res) => {
  success(res, {
    mode: getPaymentMode(),
    wechatConfigured: isWechatPayConfigured(),
    routeUnlockPaymentRequired: isRouteUnlockPaymentRequired(),
  });
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await getUserWithRoles(req.auth!.userId);
    if (user?.roles.includes(RoleCode.ADMIN) && req.query.all === '1') {
      const list = await listAllOrdersForAdmin();
      return success(res, list);
    }
    const list = await listUserOrders(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[orders/list]', err);
    return fail(res, '获取订单失败', 500, 500);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) return fail(res, '无效的订单 ID');
    const result = await getOrderById(orderId, req.auth!.userId);
    if ('error' in result) return fail(res, result.error ?? '订单不存在');
    success(res, result.order);
  } catch (err) {
    console.error('[orders/get]', err);
    return fail(res, '获取订单失败', 500, 500);
  }
});

router.post('/:id/prepay', authMiddleware, async (req, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) return fail(res, '无效的订单 ID');
    const parsed = prepaySchema.safeParse(req.body);
    if (!parsed.success) return fail(res, '参数错误');
    const result = await createOrderPrepay(orderId, req.auth!.userId, parsed.data.wxCode);
    if ('error' in result) return fail(res, result.error ?? '预下单失败');
    success(res, result.prepay, '预下单成功');
  } catch (err) {
    console.error('[orders/prepay]', err);
    return fail(res, '预下单失败', 500, 500);
  }
});

router.post('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) return fail(res, '无效的订单 ID');
    const result = await payOrder(orderId, req.auth!.userId);
    if ('error' in result) return fail(res, result.error ?? '支付失败');
    success(res, result.order, '支付成功（模拟）');
  } catch (err) {
    console.error('[orders/pay]', err);
    return fail(res, '支付失败', 500, 500);
  }
});

router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const orderId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(orderId)) return fail(res, '无效的订单 ID');
    const result = await cancelOrder(orderId, req.auth!.userId);
    if ('error' in result) return fail(res, result.error ?? '取消失败');
    success(res, result.order, '订单已取消');
  } catch (err) {
    console.error('[orders/cancel]', err);
    return fail(res, '取消订单失败', 500, 500);
  }
});

export default router;
