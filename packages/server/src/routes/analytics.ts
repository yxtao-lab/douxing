import { Router, type Request } from 'express';
import { z } from 'zod';
import {
  AnalyticsEventCategory,
  AnalyticsEventSource,
  ApiMessageKey,
  isClientAnalyticsEventName,
} from '@douxing/shared';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { success, fail } from '../utils/response.js';
import { getUserWithRoles } from '../services/user.service.js';
import { hasPermission } from '../services/permission.service.js';
import {
  getAnalyticsFunnel,
  getAnalyticsOverview,
  getAnalyticsTrends,
  getTopCheckinCities,
  trackAnalyticsEvent,
  trackAnalyticsEvents,
} from '../services/analytics.service.js';

const router = Router();

const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional(),
});

const topCitiesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const clientEventSchema = z.object({
  eventName: z.string().min(1).max(64),
  eventCategory: z
    .enum([
      AnalyticsEventCategory.BUSINESS,
      AnalyticsEventCategory.BEHAVIOR,
      AnalyticsEventCategory.SYSTEM,
    ])
    .optional(),
  sessionId: z.string().max(64).optional(),
  properties: z.record(z.unknown()).optional(),
  source: z.enum([AnalyticsEventSource.MOBILE, AnalyticsEventSource.PC]),
  occurredAt: z.string().datetime().optional(),
});

const adminEventSchema = clientEventSchema.extend({
  source: z.enum([
    AnalyticsEventSource.SERVER,
    AnalyticsEventSource.MOBILE,
    AnalyticsEventSource.PC,
    AnalyticsEventSource.WEB,
  ]),
  userId: z.number().int().positive().optional(),
});

async function resolveStaffAnalyticsAccess(req: Request) {
  if (!req.auth) return { isAdminAnalytics: false, userId: undefined as number | undefined };
  const user = await getUserWithRoles(req.auth.userId);
  if (!user) return { isAdminAnalytics: false, userId: undefined };
  const isAdminAnalytics = hasPermission(user.roles, user.permissions, 'data:analytics:view');
  return { isAdminAnalytics, userId: user.id };
}

function normalizeClientEvents(
  events: z.infer<typeof clientEventSchema>[],
  userId?: number,
) {
  return events.map((item) => ({
    eventName: item.eventName,
    eventCategory: item.eventCategory,
    sessionId: item.sessionId,
    properties: item.properties,
    source: item.source,
    userId,
    occurredAt: item.occurredAt ? new Date(item.occurredAt) : undefined,
  }));
}

router.get('/overview', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'data:analytics:view'))) return;

  try {
    const data = await getAnalyticsOverview();
    success(res, data);
  } catch (err) {
    console.error('[analytics/overview]', err);
    fail(res, ApiMessageKey.ANALYTICS_OVERVIEW_FAILED, 500, 500);
  }
});

router.get('/trends', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'data:analytics:view'))) return;

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
  if (!(await requirePerm(req, res, 'data:analytics:view'))) return;

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

router.get('/funnel', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'data:analytics:view'))) return;

  const parsed = trendsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    success(res, await getAnalyticsFunnel(parsed.data.days));
  } catch (err) {
    console.error('[analytics/funnel]', err);
    fail(res, ApiMessageKey.ANALYTICS_FUNNEL_FAILED, 500, 500);
  }
});

router.post('/events', optionalAuthMiddleware, async (req, res) => {
  const parsed = clientEventSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const { isAdminAnalytics, userId } = await resolveStaffAnalyticsAccess(req);
  const payload = parsed.data;

  if (!isAdminAnalytics) {
    if (!isClientAnalyticsEventName(payload.eventName)) {
      fail(res, ApiMessageKey.ANALYTICS_EVENT_NOT_ALLOWED, 400, 400);
      return;
    }
  }

  try {
    await trackAnalyticsEvent(normalizeClientEvents([payload], userId)[0]!);
    success(res, { ok: true });
  } catch (err) {
    console.error('[analytics/events]', err);
    fail(res, ApiMessageKey.ANALYTICS_EVENT_TRACK_FAILED, 500, 500);
  }
});

router.post('/events/batch', optionalAuthMiddleware, async (req, res) => {
  const parsed = z.object({ events: z.array(clientEventSchema).min(1).max(20) }).safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  const { isAdminAnalytics, userId } = await resolveStaffAnalyticsAccess(req);
  if (!isAdminAnalytics) {
    for (const item of parsed.data.events) {
      if (!isClientAnalyticsEventName(item.eventName)) {
        fail(res, ApiMessageKey.ANALYTICS_EVENT_NOT_ALLOWED, 400, 400);
        return;
      }
    }
  }

  try {
    await trackAnalyticsEvents(normalizeClientEvents(parsed.data.events, userId));
    success(res, { ok: true, count: parsed.data.events.length });
  } catch (err) {
    console.error('[analytics/events/batch]', err);
    fail(res, ApiMessageKey.ANALYTICS_EVENT_TRACK_FAILED, 500, 500);
  }
});

/** 管理端手动写入（保留 DT1 能力） */
router.post('/events/admin', authMiddleware, async (req, res) => {
  if (!(await requirePerm(req, res, 'data:analytics:view'))) return;

  const parsed = adminEventSchema.safeParse(req.body);
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
    console.error('[analytics/events/admin]', err);
    fail(res, ApiMessageKey.ANALYTICS_EVENT_TRACK_FAILED, 500, 500);
  }
});

export default router;
