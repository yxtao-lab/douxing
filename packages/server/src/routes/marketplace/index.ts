import { Router } from 'express';
import healthRouter from './health.js';
import categoriesRouter from './categories.js';
import demandsRouter from './demands.js';
import groupsRouter from './groups.js';
import orgsRouter from './orgs.js';
import providersRouter from './providers.js';
import adminRouter from './admin.js';
import ordersRouter from './orders.js';
import partnerRouter from './partner.js';
import quotesRouter from './quotes.js';
import notificationsRouter from './notifications.js';
import productsRouter from './products.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/categories', categoriesRouter);
router.use('/demands', demandsRouter);
router.use('/groups', groupsRouter);
router.use('/orders', ordersRouter);
router.use('/orgs', orgsRouter);
router.use('/providers', providersRouter);
router.use('/partner', partnerRouter);
router.use('/products', productsRouter);
router.use('/quotes', quotesRouter);
router.use('/notifications', notificationsRouter);
router.use('/admin', adminRouter);

export default router;
