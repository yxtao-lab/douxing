import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import {
  listAchievementCatalog,
  listUserAchievements,
} from '../services/achievement.service.js';

const router = Router();

/** 成就图鉴（含解锁状态与进度） */
router.get('/catalog', authMiddleware, async (req, res) => {
  try {
    const list = await listAchievementCatalog(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[achievements/catalog]', err);
    return fail(res, '获取成就图鉴失败', 500, 500);
  }
});

/** 已解锁成就列表 */
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const list = await listUserAchievements(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[achievements/mine]', err);
    return fail(res, '获取我的成就失败', 500, 500);
  }
});

/** 兼容旧接口：返回已解锁成就 */
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
