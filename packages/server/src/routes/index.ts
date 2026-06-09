import { Router } from 'express';
import { API_PREFIX } from '@douxing/shared';
import healthRouter from './health.js';
import authRouter from './auth.js';
import routesRouter from './routes.js';
import checkinsRouter from './checkins.js';
import ordersRouter from './orders.js';
import achievementsRouter from './achievements.js';
import badgesRouter from './badges.js';
import leaderboardRouter from './leaderboard.js';
import usersRouter from './users.js';
import attractionsRouter from './attractions.js';
import speechRouter from './speech.js';
import shareRouter from './share.js';

import playbooksRouter from './playbooks.js';
import journeyAlbumsRouter from './journey-albums.js';

const router = Router();

router.use(`${API_PREFIX}/health`, healthRouter);
router.use(`${API_PREFIX}/auth`, authRouter);
router.use(`${API_PREFIX}/users`, usersRouter);
router.use(`${API_PREFIX}/attractions`, attractionsRouter);
router.use(`${API_PREFIX}/routes`, routesRouter);
router.use(`${API_PREFIX}/checkins`, checkinsRouter);
router.use(`${API_PREFIX}/orders`, ordersRouter);
router.use(`${API_PREFIX}/achievements`, achievementsRouter);
router.use(`${API_PREFIX}/badges`, badgesRouter);
router.use(`${API_PREFIX}/leaderboard`, leaderboardRouter);
router.use(`${API_PREFIX}/speech`, speechRouter);
router.use(`${API_PREFIX}/share`, shareRouter);
router.use(`${API_PREFIX}/playbooks`, playbooksRouter);
router.use(`${API_PREFIX}/journey-albums`, journeyAlbumsRouter);

export default router;
