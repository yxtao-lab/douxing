import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getLeaderboard } from '../services/leaderboard.service.js';
import { LEADERBOARD_MAX_LIMIT } from '@douxing/shared';

const router = Router();

const querySchema = z.object({
  period: z.enum(['week', 'month']).default('week'),
  metric: z.enum(['checkins', 'points']).default('checkins'),
  limit: z.coerce.number().int().min(1).max(LEADERBOARD_MAX_LIMIT).optional(),
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return fail(res, parsed.error.errors[0]?.message ?? '参数错误');
    }

    const result = await getLeaderboard({
      period: parsed.data.period,
      metric: parsed.data.metric,
      limit: parsed.data.limit,
      currentUserId: req.auth!.userId,
    });
    success(res, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '获取排行榜失败';
    console.error('[leaderboard/list]', err);
    return fail(res, message, 500, 500);
  }
});

export default router;
