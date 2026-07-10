import { Router } from 'express';
import healthRouter from './health.js';
import categoriesRouter from './categories.js';
import demandsRouter from './demands.js';
import orgsRouter from './orgs.js';
import providersRouter from './providers.js';
import adminRouter from './admin.js';
import ordersRouter from './orders.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/categories', categoriesRouter);
router.use('/demands', demandsRouter);
router.use('/orders', ordersRouter);
router.use('/orgs', orgsRouter);
router.use('/providers', providersRouter);
router.use('/admin', adminRouter);

export default router;
