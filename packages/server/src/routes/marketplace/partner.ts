import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import { ApiMessageKey, OrgRole } from '@douxing/shared';
import { getMarketplacePartnerContext } from '../../services/marketplace/marketplace-partner.service.js';
import { enrollMerchantAdminAccess } from '../../services/marketplace/marketplace-merchant-role.service.js';
import { getOrgRoleForUser } from '../../services/marketplace/marketplace-org-onboard.service.js';
import { listSettlementsByOrg } from '../../services/marketplace/marketplace-settlement.service.js';

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

/**
 * 商户结算台账列表（仅 owner/admin；M7-5 Partner 财务页消费）。
 *
 * @route GET /api/marketplace/partner/settlements?orgId=&status=
 */
router.get('/settlements', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const orgId = Number(req.query.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const role = await getOrgRoleForUser(req.auth.userId, orgId);
    if (role !== OrgRole.OWNER && role !== OrgRole.ADMIN) {
      fail(res, ApiMessageKey.MARKETPLACE_ORG_MEMBER_FORBIDDEN, 403, 403);
      return;
    }
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const items = await listSettlementsByOrg(orgId, status);
    success(res, { items });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
