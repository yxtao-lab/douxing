import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { listUserAchievements } from '../services/achievement.service.js';

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const list = await listUserAchievements(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[achievements/list]', err);
    return fail(res, '获取成就失败', 500, 500);
  }
});

export default router;
