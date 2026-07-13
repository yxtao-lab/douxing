import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { failFromError, success } from '../../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import { listPartnerQuotesByUser } from '../../services/marketplace/marketplace-quote.service.js';

const router = Router();

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const items = await listPartnerQuotesByUser(req.auth!.userId);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
