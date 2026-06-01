import { Router } from 'express';
import { ApiError, ApiMessageKey } from '@douxing/shared';
import { success, fail } from '../utils/response.js';
import { assertPublishedRouteForPoster, getPublicSharedRoute } from '../services/share.service.js';
import {
  createRouteShareUrlLink,
  createRouteShareWxacode,
  getWechatMiniCredentials,
} from '../services/wechat-mini.service.js';

const router = Router();

/** D5-a：公开路线只读摘要（无需登录） */
router.get('/routes/:id', async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    const route = await getPublicSharedRoute(routeId);
    if (!route) {
      return fail(res, ApiMessageKey.SHARE_ROUTE_NOT_AVAILABLE, 404, 404);
    }
    success(res, route);
  } catch (err) {
    console.error('[share/routes/:id]', err);
    return fail(res, ApiMessageKey.SHARE_ROUTE_LOAD_FAILED, 500, 500);
  }
});

/** D5 补全：路线分享小程序码 PNG（无需登录，已发布路线） */
router.get('/routes/:id/wxacode', async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    if (!getWechatMiniCredentials()) {
      return fail(res, ApiMessageKey.SHARE_WXACODE_NOT_CONFIGURED, 503, 503);
    }
    await assertPublishedRouteForPoster(routeId);
    const buffer = await createRouteShareWxacode(routeId);
    if (!buffer) {
      return fail(res, ApiMessageKey.SHARE_WXACODE_FAILED, 502, 502);
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    if (err instanceof ApiError) {
      const status = err.messageKey === ApiMessageKey.SHARE_ROUTE_NOT_AVAILABLE ? 404 : 400;
      return fail(res, err.messageKey, status, status);
    }
    console.error('[share/routes/:id/wxacode]', err);
    return fail(res, ApiMessageKey.SHARE_WXACODE_FAILED, 500, 500);
  }
});

/** D5 补全：微信 URL Link（海报标准 QR 兜底） */
router.get('/routes/:id/link', async (req, res) => {
  try {
    const routeId = parseInt(String(req.params.id), 10);
    if (Number.isNaN(routeId)) {
      return fail(res, ApiMessageKey.INVALID_ROUTE_ID);
    }
    if (!getWechatMiniCredentials()) {
      return fail(res, ApiMessageKey.SHARE_WXACODE_NOT_CONFIGURED, 503, 503);
    }
    await assertPublishedRouteForPoster(routeId);
    const urlLink = await createRouteShareUrlLink(routeId);
    if (!urlLink) {
      return fail(res, ApiMessageKey.SHARE_WXACODE_FAILED, 502, 502);
    }
    success(res, { url: urlLink });
  } catch (err) {
    if (err instanceof ApiError) {
      const status = err.messageKey === ApiMessageKey.SHARE_ROUTE_NOT_AVAILABLE ? 404 : 400;
      return fail(res, err.messageKey, status, status);
    }
    console.error('[share/routes/:id/link]', err);
    return fail(res, ApiMessageKey.SHARE_WXACODE_FAILED, 500, 500);
  }
});

export default router;
