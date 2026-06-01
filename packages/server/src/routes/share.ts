import { Router } from 'express';
import { ApiMessageKey } from '@douxing/shared';
import { success, fail } from '../utils/response.js';
import { getPublicSharedRoute } from '../services/share.service.js';

const router = Router();

/** D5-a：公开路线只读摘要（无需登录） */
router.get('/routes/:id', async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const route = await getPublicSharedRoute(routeId);
    if (!route) {
      return fail(res, ApiMessageKey.SHARE_ROUTE_NOT_AVAILABLE, 404, 404);
    }
    success(res, route);
  } catch (err) {
    console.error('[share/routes/:id]', err);
    return fail(res, ApiMessageKey.SHARE_ROUTE_LOAD_FAILED, 500, 500);
  }
});

export default router;
