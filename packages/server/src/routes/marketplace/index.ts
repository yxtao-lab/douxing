import { Router } from 'express';
import healthRouter from './health.js';
import categoriesRouter from './categories.js';
import demandsRouter from './demands.js';
import adminRouter from './admin.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/categories', categoriesRouter);
router.use('/demands', demandsRouter);
router.use('/admin', adminRouter);

export default router;
