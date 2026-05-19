import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  createCheckIn,
  listUserCheckIns,
  listRouteCheckIns,
  listAllCheckInsForAdmin,
} from '../services/checkin.service.js';
import { getUserWithRoles } from '../services/user.service.js';
import { RoleCode } from '@douxing/shared';

const router = Router();

const checkInSchema = z.object({
  routeId: z.number().int().positive(),
  location: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    address: z.string().optional(),
    placeName: z.string().min(1, '请填写打卡地点'),
  }),
  remark: z.string().max(512).optional(),
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }
    const { checkIn, newAchievements } = await createCheckIn(req.auth!.userId, parsed.data);
    success(res, { checkIn, newAchievements }, '打卡成功');
  } catch (err) {
    console.error('[checkins/create]', err);
    return fail(res, '打卡失败', 500, 500);
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await getUserWithRoles(req.auth!.userId);
    if (user?.roles.includes(RoleCode.ADMIN) && req.query.all === '1') {
      const list = await listAllCheckInsForAdmin();
      return success(res, list);
    }
    const routeId = req.query.routeId ? parseInt(String(req.query.routeId), 10) : null;
    if (routeId && !Number.isNaN(routeId)) {
      const list = await listRouteCheckIns(routeId, req.auth!.userId);
      return success(res, list);
    }
    const list = await listUserCheckIns(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[checkins/list]', err);
    return fail(res, '获取打卡记录失败', 500, 500);
  }
});

export default router;
