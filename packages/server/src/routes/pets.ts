import { Router } from 'express';
import { z } from 'zod';
import {
  ApiError,
  ApiMessageKey,
  PET_ANALYZE_SCENES,
  TRAVEL_PET_PERSONALITIES,
  TRAVEL_PET_SPECIES,
  isPetAnalyzeScene,
} from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail, failFromError } from '../utils/response.js';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  adoptTravelPet,
  getTravelPetByUserId,
  getTravelPetFloatingContext,
  updateTravelPetProfile,
} from '../services/travel-pet.service.js';
import {
  confirmSuggestedMemories,
  deleteUserMemory,
  ensureTravelPet,
  listUserMemoriesPaginated,
  setUserMemoryPinned,
} from '../services/pet-memory.service.js';
import { analyzeTravelPet } from '../services/pet-analyze.service.js';

const router = Router();

const speciesSchema = z.enum(TRAVEL_PET_SPECIES);
const personalitySchema = z.enum(TRAVEL_PET_PERSONALITIES);

const adoptSchema = z.object({
  species: speciesSchema,
  nickname: z.string().min(1).max(64),
  personality: personalitySchema,
});

const updateSchema = z
  .object({
    nickname: z.string().min(1).max(64).optional(),
    personality: personalitySchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'empty update' });

const analyzeSchema = z.object({
  scene: z.enum(PET_ANALYZE_SCENES),
  routeId: z.number().int().positive().optional(),
  sessionId: z.number().int().positive().optional(),
});

const confirmMemoriesSchema = z.object({
  items: z
    .array(
      z.object({
        memoryType: z.string().min(1).max(32),
        content: z.string().min(1).max(2000),
        importance: z.number().int().min(1).max(10).optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .min(1)
    .max(10),
});

const pinSchema = z.object({
  pinned: z.boolean(),
});

router.post('/adopt', authMiddleware, async (req, res) => {
  try {
    const parsed = adoptSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR);
    }
    const pet = await adoptTravelPet(req.auth!.userId, parsed.data);
    success(res, pet, ApiMessageKey.PET_ADOPT_SUCCESS);
  } catch (err) {
    if (err instanceof ApiError) {
      const status = err.messageKey === ApiMessageKey.PET_ALREADY_ADOPTED ? 409 : 400;
      return fail(res, err.messageKey, 1, status, err.params);
    }
    console.error('[pets/adopt]', err);
    return fail(res, ApiMessageKey.PET_ADOPT_FAILED, 500, 500);
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const pet = await getTravelPetByUserId(req.auth!.userId);
    if (!pet) {
      return fail(res, ApiMessageKey.PET_NOT_FOUND, 404, 404);
    }
    success(res, pet, ApiMessageKey.OK);
  } catch (err) {
    console.error('[pets/me GET]', err);
    return fail(res, ApiMessageKey.PET_FETCH_FAILED, 500, 500);
  }
});

/** H3-b：悬浮层上下文（与规划 orchestrator 共用 buildPlanPetMeta） */
router.get('/me/floating-context', authMiddleware, async (req, res) => {
  try {
    const locale = res.locals.locale ?? 'zh-CN';
    const context = await getTravelPetFloatingContext(req.auth!.userId, locale);
    if (!context) {
      return fail(res, ApiMessageKey.PET_NOT_FOUND, 404, 404);
    }
    success(res, context, ApiMessageKey.OK);
  } catch (err) {
    console.error('[pets/me/floating-context]', err);
    return fail(res, ApiMessageKey.PET_FETCH_FAILED, 500, 500);
  }
});

router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR);
    }
    const pet = await updateTravelPetProfile(req.auth!.userId, parsed.data);
    success(res, pet, ApiMessageKey.PET_UPDATE_SUCCESS);
  } catch (err) {
    if (err instanceof ApiError && err.messageKey === ApiMessageKey.PET_NOT_FOUND) {
      return fail(res, err.messageKey, 404, 404, err.params);
    }
    console.error('[pets/me PATCH]', err);
    return failFromError(res, err, ApiMessageKey.PET_UPDATE_FAILED);
  }
});

/** H3-c：记忆墙分页 */
router.get('/me/memories', authMiddleware, async (req, res) => {
  try {
    await ensureTravelPet(req.auth!.userId);
    const { page, pageSize } = parsePaginationQuery(req.query as Record<string, unknown>);
    const result = await listUserMemoriesPaginated(req.auth!.userId, page, pageSize);
    success(res, result, ApiMessageKey.OK);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(res, err.messageKey, 400, 400, err.params);
    }
    console.error('[pets/me/memories GET]', err);
    return fail(res, ApiMessageKey.PET_MEMORY_FETCH_FAILED, 500, 500);
  }
});

/** H3-c：删除记忆 */
router.delete('/me/memories/:id', authMiddleware, async (req, res) => {
  try {
    const memoryId = Number(req.params.id);
    if (!Number.isFinite(memoryId) || memoryId <= 0) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR);
    }
    await deleteUserMemory(req.auth!.userId, memoryId);
    success(res, { id: memoryId }, ApiMessageKey.PET_MEMORY_DELETE_SUCCESS);
  } catch (err) {
    if (err instanceof ApiError && err.messageKey === ApiMessageKey.PET_MEMORY_NOT_FOUND) {
      return fail(res, err.messageKey, 404, 404, err.params);
    }
    console.error('[pets/me/memories DELETE]', err);
    return fail(res, ApiMessageKey.PET_MEMORY_DELETE_FAILED, 500, 500);
  }
});

/** H3-c：置顶 / 取消置顶 */
router.patch('/me/memories/:id', authMiddleware, async (req, res) => {
  try {
    const memoryId = Number(req.params.id);
    const parsed = pinSchema.safeParse(req.body);
    if (!Number.isFinite(memoryId) || memoryId <= 0 || !parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR);
    }
    const item = await setUserMemoryPinned(req.auth!.userId, memoryId, parsed.data.pinned);
    success(res, item, ApiMessageKey.OK);
  } catch (err) {
    if (err instanceof ApiError && err.messageKey === ApiMessageKey.PET_MEMORY_NOT_FOUND) {
      return fail(res, err.messageKey, 404, 404, err.params);
    }
    console.error('[pets/me/memories PATCH]', err);
    return fail(res, ApiMessageKey.PET_MEMORY_FETCH_FAILED, 500, 500);
  }
});

/** H3-c：确认写入 analyze 建议的记忆 */
router.post('/me/memories', authMiddleware, async (req, res) => {
  try {
    const parsed = confirmMemoriesSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, ApiMessageKey.VALIDATION_ERROR);
    }
    const ids = await confirmSuggestedMemories(req.auth!.userId, parsed.data.items);
    success(res, { ids }, ApiMessageKey.PET_MEMORY_SAVE_SUCCESS);
  } catch (err) {
    console.error('[pets/me/memories POST]', err);
    return fail(res, ApiMessageKey.PET_MEMORY_SAVE_FAILED, 500, 500);
  }
});

/** H3-c：宠物 AI 分析 */
router.post('/me/analyze', authMiddleware, async (req, res) => {
  try {
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success || !isPetAnalyzeScene(parsed.data?.scene ?? '')) {
      return fail(res, ApiMessageKey.PET_ANALYZE_INVALID_SCENE);
    }
    const locale = res.locals.locale ?? 'zh-CN';
    const result = await analyzeTravelPet(req.auth!.userId, parsed.data, locale);
    success(res, result, ApiMessageKey.OK);
  } catch (err) {
    if (err instanceof ApiError) {
      const status = err.messageKey === ApiMessageKey.ROUTE_NOT_FOUND ? 404 : 400;
      return fail(res, err.messageKey, status, status, err.params);
    }
    console.error('[pets/me/analyze]', err);
    return fail(res, ApiMessageKey.PET_ANALYZE_FAILED, 500, 500);
  }
});

export default router;
