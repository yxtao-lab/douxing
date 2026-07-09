import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { requirePerm } from '../../middleware/admin.middleware.js';
import { failFromError, success } from '../../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import { listBizOrgsForAdmin } from '../../services/marketplace/marketplace-org.service.js';

const router = Router();

router.get('/orgs', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'marketplace:org:list'))) return;

  try {
    const items = await listBizOrgsForAdmin();
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
