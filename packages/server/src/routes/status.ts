import { Router } from 'express';
import { success } from '../utils/response.js';
import { ApiMessageKey } from '@douxing/shared';
import { getSiteStatusSummary } from '../services/site-status.service.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    success(res, await getSiteStatusSummary(), ApiMessageKey.OK);
  } catch (err) {
    console.error('[status]', err);
    success(res, { online: true, maintenanceMode: false }, ApiMessageKey.OK);
  }
});

export default router;
