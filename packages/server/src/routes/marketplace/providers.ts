import { Router } from 'express';
import { z } from 'zod';
import {
  ApiMessageKey,
  ProviderType,
} from '@douxing/shared';
import { authMiddleware } from '../../middleware/auth.js';
import { fail, failFromError, success } from '../../utils/response.js';
import {
  applyServiceProvider,
  getApprovedProviderPublicProfile,
  getServiceProviderByUserId,
} from '../../services/marketplace/marketplace-provider.service.js';
import { resolvePublicAssetUrl, resolvePublicBaseFromRequest } from '../../utils/public-asset-url.util.js';

const router = Router();

const applySchema = z.object({
  providerType: z.enum([
    ProviderType.GUIDE,
    ProviderType.PHOTOGRAPHER,
    ProviderType.MODEL,
    ProviderType.RETOUCHER,
    ProviderType.LEADER,
  ]),
  categoryCodes: z.array(z.string().min(1).max(64)).min(1),
  serviceRegions: z.array(z.string().max(64)).optional(),
  orgId: z.coerce.number().int().positive().optional(),
  displayName: z.string().max(64).optional(),
  bio: z.string().max(2000).optional(),
  portfolioUrls: z.array(z.string().max(512)).optional(),
});

/**
 * 将作品集路径列表解析为对外 URL。
 *
 * @param req - Express 请求
 * @param urls - 存储路径列表
 * @returns 完整 URL 列表
 */
function resolvePortfolioUrls(
  req: import('express').Request,
  urls: string[] | null | undefined,
): string[] | null {
  if (!urls?.length) return null;
  const publicBase = resolvePublicBaseFromRequest(req);
  return urls.map((url) => resolvePublicAssetUrl(url, { publicBase }) ?? url);
}

router.post('/apply', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, ApiMessageKey.MARKETPLACE_PROVIDER_APPLY_INVALID, 400, 400);
    return;
  }

  try {
    const provider = await applyServiceProvider(req.auth.userId, parsed.data);
    success(res, {
      ...provider,
      portfolioUrls: resolvePortfolioUrls(req, provider.portfolioUrls),
    });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  if (!req.auth) {
    fail(res, ApiMessageKey.UNAUTHORIZED, 401, 401);
    return;
  }

  try {
    const provider = await getServiceProviderByUserId(req.auth.userId);
    if (!provider) {
      success(res, { provider: null });
      return;
    }
    success(res, {
      provider: {
        ...provider,
        portfolioUrls: resolvePortfolioUrls(req, provider.portfolioUrls),
      },
    });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

router.get('/:id', async (req, res) => {
  const providerId = parseInt(String(req.params.id), 10);
  if (Number.isNaN(providerId) || providerId <= 0) {
    fail(res, ApiMessageKey.PARAM_ERROR, 400, 400);
    return;
  }

  try {
    const profile = await getApprovedProviderPublicProfile(providerId);
    if (!profile) {
      fail(res, ApiMessageKey.MARKETPLACE_PROVIDER_NOT_APPROVED, 404, 404);
      return;
    }
    success(res, {
      ...profile,
      portfolioUrls: resolvePortfolioUrls(req, profile.portfolioUrls),
    });
  } catch (err) {
    failFromError(res, err, ApiMessageKey.SERVER_ERROR);
  }
});

export default router;
