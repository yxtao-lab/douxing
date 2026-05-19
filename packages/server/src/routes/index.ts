import { Router } from 'express';
import { API_PREFIX } from '@douxing/shared';
import healthRouter from './health.js';
import authRouter from './auth.js';

const router = Router();

router.use(`${API_PREFIX}/health`, healthRouter);
router.use(`${API_PREFIX}/auth`, authRouter);

export default router;
