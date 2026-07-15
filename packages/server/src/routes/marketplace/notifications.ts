import { Router } from 'express';
import { z } from 'zod';
import { ApiMessageKey } from '@douxing/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  listNotificationsForUser,
  markNotificationRead,
} from '../../services/marketplace/marketplace-notification.service.js';

const router = Router();

/**
 * 列出当前用户的发单接单站内通知。
 *
 * @route GET /api/marketplace/notifications
 */
router.get('/', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const unreadOnly = req.query.unreadOnly === '1' || req.query.unreadOnly === 'true';
  const limitParsed = z.coerce.number().int().min(1).max(200).safeParse(req.query.limit);

  try {
    const items = await listNotificationsForUser(req.auth.userId, {
      unreadOnly,
      limit: limitParsed.success ? limitParsed.data : undefined,
    });
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

/**
 * 将指定通知标记为已读。
 *
 * @route PATCH /api/marketplace/notifications/:id/read
 */
router.patch('/:id/read', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const item = await markNotificationRead(id, req.auth.userId);
    success(res, item);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
