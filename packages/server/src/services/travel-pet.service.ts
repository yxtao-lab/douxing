/**
 * H3-a：旅行宠物领养与资料读写
 */
import { eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  TRAVEL_PET_DEFAULT_NICKNAME,
  isTravelPetPersonality,
  isTravelPetSpecies,
  type AdoptTravelPetRequest,
  type LocaleCode,
  type TravelPetFloatingContext,
  type TravelPetInfo,
  type TravelPetMood,
  type TravelPetPersonality,
  type TravelPetSpecies,
  type UpdateTravelPetRequest,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { travelPets, type TravelPet } from '../db/schema/travel-pets.js';
import { ensureTravelPet } from './pet-memory.service.js';
import { buildPlanPetMeta } from './plan-pet-meta.service.js';

function rowToInfo(row: TravelPet): TravelPetInfo {
  return {
    id: row.id,
    species: row.species as TravelPetSpecies,
    nickname: row.nickname,
    personality: row.personality as TravelPetPersonality,
    level: row.level,
    exp: row.exp,
    mood: row.mood as TravelPetMood,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function assertValidSpecies(species: string): TravelPetSpecies {
  if (!isTravelPetSpecies(species)) {
    throw new ApiError(ApiMessageKey.PET_INVALID_SPECIES);
  }
  return species;
}

function assertValidPersonality(personality: string): TravelPetPersonality {
  if (!isTravelPetPersonality(personality)) {
    throw new ApiError(ApiMessageKey.PET_INVALID_PERSONALITY);
  }
  return personality;
}

/** 是否为 Agent 懒创建的默认宠物（可首次正式领养覆盖） */
export function isDefaultAutoTravelPet(row: TravelPet): boolean {
  return (
    row.nickname === TRAVEL_PET_DEFAULT_NICKNAME &&
    row.species === 'fox' &&
    row.personality === 'guide' &&
    row.level === 1 &&
    row.exp === 0
  );
}

export async function getTravelPetByUserId(userId: number): Promise<TravelPetInfo | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.userId, userId))
    .limit(1);
  return rows[0] ? rowToInfo(rows[0]) : null;
}

/** H3-b：悬浮层与规划页共用 memory 召回（buildPlanPetMeta） */
export async function getTravelPetFloatingContext(
  userId: number,
  locale: LocaleCode,
): Promise<TravelPetFloatingContext | null> {
  await ensureTravelPet(userId);
  const pet = await getTravelPetByUserId(userId);
  if (!pet) return null;
  const petMeta = await buildPlanPetMeta(userId, locale, null);
  return { pet, petMeta };
}

export async function adoptTravelPet(
  userId: number,
  input: AdoptTravelPetRequest,
): Promise<TravelPetInfo> {
  const species = assertValidSpecies(input.species);
  const personality = assertValidPersonality(input.personality);
  const nickname = input.nickname.trim();
  if (!nickname || nickname.length > 64) {
    throw new ApiError(ApiMessageKey.VALIDATION_ERROR);
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.userId, userId))
    .limit(1);

  if (existing[0]) {
    if (isDefaultAutoTravelPet(existing[0])) {
      await db
        .update(travelPets)
        .set({ species, nickname, personality })
        .where(eq(travelPets.id, existing[0].id));
      const updated = await db
        .select()
        .from(travelPets)
        .where(eq(travelPets.id, existing[0].id))
        .limit(1);
      return rowToInfo(updated[0]!);
    }
    throw new ApiError(ApiMessageKey.PET_ALREADY_ADOPTED);
  }

  const [result] = await db.insert(travelPets).values({
    userId,
    species,
    nickname,
    personality,
  });
  const rows = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.id, Number(result.insertId)))
    .limit(1);
  return rowToInfo(rows[0]!);
}

export async function updateTravelPetProfile(
  userId: number,
  input: UpdateTravelPetRequest,
): Promise<TravelPetInfo> {
  const patch: Partial<Pick<TravelPet, 'nickname' | 'personality'>> = {};

  if (input.nickname !== undefined) {
    const nickname = input.nickname.trim();
    if (!nickname || nickname.length > 64) {
      throw new ApiError(ApiMessageKey.VALIDATION_ERROR);
    }
    patch.nickname = nickname;
  }
  if (input.personality !== undefined) {
    patch.personality = assertValidPersonality(input.personality);
  }
  if (Object.keys(patch).length === 0) {
    throw new ApiError(ApiMessageKey.VALIDATION_ERROR);
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.userId, userId))
    .limit(1);
  if (!existing[0]) {
    throw new ApiError(ApiMessageKey.PET_NOT_FOUND);
  }

  await db.update(travelPets).set(patch).where(eq(travelPets.id, existing[0].id));
  const rows = await db
    .select()
    .from(travelPets)
    .where(eq(travelPets.id, existing[0].id))
    .limit(1);
  return rowToInfo(rows[0]!);
}

/** 验收/测试清理用 */
export async function deleteTravelPetForUser(userId: number): Promise<void> {
  const db = getDb();
  await db.delete(travelPets).where(eq(travelPets.userId, userId));
}
