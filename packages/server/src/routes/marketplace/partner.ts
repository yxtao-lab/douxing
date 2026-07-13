import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { failFromError, success } from '../../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import { getMarketplacePartnerContext } from '../../services/marketplace/marketplace-partner.service.js';
import { enrollMerchantAdminAccess } from '../../services/marketplace/marketplace-merchant-role.service.js';

const router = Router();

router.post('/enroll', authMiddleware, async (req, res) => {
  try {
    await enrollMerchantAdminAccess(req.auth!.userId);
    success(res, { ok: true });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/context', authMiddleware, async (req, res) => {
  try {
    const context = await getMarketplacePartnerContext(req.auth!.userId);
    success(res, context);
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
