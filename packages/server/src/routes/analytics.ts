import { Router } from 'express';
import { z } from 'zod';
import {
  AnalyticsEventCategory,
  AnalyticsEventSource,
  ApiMessageKey,
  RoleCode,
} from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import {
  getAnalyticsOverview,
  getAnalyticsTrends,
  getTopCheckinCities,
  trackAnalyticsEvent,
} from '../services/analytics.service.js';

const router = Router();

const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

const topCitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const trackEventSchema = z.object({
  eventName: z.string().min(1).max(64),
  eventCategory: z
    .enum([
      AnalyticsEventCategory.BUSINESS,
      AnalyticsEventCategory.BEHAVIOR,
      AnalyticsEventCategory.SYSTEM,
    ])
    .optional(),
  userId: z.number().int().positive().optional(),
  sessionId: z.string().max(64).optional(),
  properties: z.record(z.unknown()).optional(),
  source: z
    .enum([
      AnalyticsEventSource.SERVER,
      AnalyticsEventSource.MOBILE,
      AnalyticsEventSource.PC,
      AnalyticsEventSource.WEB,
    ])
    .optional(),
  occurredAt: z.string().datetime().optional(),
});

async function requireAdmin(req: import('express').Request, res: import('express').Response) {
  const user = await getUserWithRoles(req.auth!.userId);
  if (!user?.roles.includes(RoleCode.ADMIN)) {
    fail(res, ApiMessageKey.ADMIN_REQUIRED, 403, 403);
    return null;
  }
  return user;
}

router.get('/overview', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const data = await getAnalyticsOverview();
    success(res, data);
  } catch (err) {
    console.error('[analytics/overview]', err);
    fail(res, ApiMessageKey.ANALYTICS_OVERVIEW_FAILED, 500, 500);
  }
});

router.get('/trends', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const parsed = trendsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const data = await getAnalyticsTrends(parsed.data.days);
    success(res, data);
  } catch (err) {
    console.error('[analytics/trends]', err);
    fail(res, ApiMessageKey.ANALYTICS_TRENDS_FAILED, 500, 500);
  }
});

router.get('/top-cities', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const parsed = topCitiesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const data = await getTopCheckinCities(parsed.data.limit);
    success(res, data);
  } catch (err) {
    console.error('[analytics/top-cities]', err);
    fail(res, ApiMessageKey.ANALYTICS_TOP_CITIES_FAILED, 500, 500);
  }
});

router.post('/events', authMiddleware, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;

  const parsed = trackEventSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    await trackAnalyticsEvent({
      ...parsed.data,
      occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : undefined,
    });
    success(res, { ok: true });
  } catch (err) {
    console.error('[analytics/events]', err);
    fail(res, ApiMessageKey.ANALYTICS_EVENT_TRACK_FAILED, 500, 500);
  }
});

export default router;
