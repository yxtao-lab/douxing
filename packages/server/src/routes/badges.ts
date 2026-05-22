import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { listBadgeCatalog, listUserBadges } from '../services/badge.service.js';

const router = Router();

/** 徽章图鉴（含解锁状态与进度） */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const list = await listBadgeCatalog(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[badges/catalog]', err);
    return fail(res, '获取徽章图鉴失败', 500, 500);
  }
});

/** 已解锁徽章列表 */
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const list = await listUserBadges(req.auth!.userId);
    success(res, list);
  } catch (err) {
    console.error('[badges/mine]', err);
    return fail(res, '获取我的徽章失败', 500, 500);
  }
});

export default router;
