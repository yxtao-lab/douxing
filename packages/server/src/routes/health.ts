import { Router } from 'express';
import { APP_NAME } from '@douxing/shared';
import { success } from '../utils/response.js';

const router = Router();

router.get('/', (_req, res) => {
  success(res, {
    name: APP_NAME,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
