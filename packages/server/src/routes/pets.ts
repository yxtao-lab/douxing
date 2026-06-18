import { Router } from 'express';
import { z } from 'zod';
import {
  ApiError,
  ApiMessageKey,
  TRAVEL_PET_PERSONALITIES,
  TRAVEL_PET_SPECIES,
} from '@douxing/shared';
import { authMiddleware } from '../middleware/auth.js';
import { success, fail, failFromError } from '../utils/response.js';
import {
  adoptTravelPet,
  getTravelPetByUserId,
  updateTravelPetProfile,
} from '../services/travel-pet.service.js';

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

export default router;
