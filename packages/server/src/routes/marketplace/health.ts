import { Router } from 'express';
import { success } from '../../utils/response.js';

const router = Router();

router.get('/', (_req, res) => {
  success(res, {
    ok: true,
    module: 'marketplace',
    timestamp: new Date().toISOString(),
  });
});

export default router;
