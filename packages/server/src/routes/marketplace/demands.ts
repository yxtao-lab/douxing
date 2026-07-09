import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { failFromError, success } from '../../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import {
  getDemandByIdForUser,
  listDemandsByUser,
} from '../../services/marketplace/marketplace-demand.service.js';

const router = Router();

/**
 * 解析路径中的需求单 ID。
 *
 * @param raw - 路由参数原始字符串
 * @returns 正整数 ID；非法时 `null`
 */
function parseDemandId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  return id;
}

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const userId = req.auth!.userId;
    const items = await listDemandsByUser(userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  const rawId = req.params.id;
  const id = parseDemandId(Array.isArray(rawId) ? rawId[0] ?? '' : rawId ?? '');
  if (!id) {
    return failFromError(res, new Error('invalid id'), ApiMessageKey.PARAM_ERROR);
  }

  try {
    const demand = await getDemandByIdForUser(id, req.auth!.userId);
    success(res, demand);
  } catch (err) {
    failFromError(res, err);
  }
});

export default router;
