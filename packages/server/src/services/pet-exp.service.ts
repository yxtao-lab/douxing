/**
 * H3-d · Step 34：打卡奖励宠物经验与升级
 */
import {
  PET_CHECKIN_EXP_BASE,
  PET_CHECKIN_EXP_FIRST_BONUS,
  PET_CHECKIN_EXP_PHOTO_BONUS,
  PET_EXP_PER_LEVEL_UNIT,
  TRAVEL_PET_DEFAULT_NICKNAME,
  type LocaleCode,
  type PetCheckInCelebration,
  type TravelPetPersonality,
  formatPetCheckInCelebrationLevelUpReply,
  formatPetCheckInCelebrationReply,
} from '@douxing/shared';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { travelPets } from '../db/schema/travel-pets.js';
import { ensureTravelPet } from './pet-memory.service.js';

export function computeCheckInPetExp(input: {
  hasPhoto: boolean;
  isFirstAtAttraction: boolean;
}): number {
  let exp = PET_CHECKIN_EXP_BASE;
  if (input.hasPhoto) exp += PET_CHECKIN_EXP_PHOTO_BONUS;
  if (input.isFirstAtAttraction) exp += PET_CHECKIN_EXP_FIRST_BONUS;
  return exp;
}

export function expRequiredToLevelUp(level: number): number {
  return Math.max(level, 1) * PET_EXP_PER_LEVEL_UNIT;
}

export function applyPetExpGain(
  level: number,
  exp: number,
  gained: number,
): { level: number; exp: number; leveledUp: boolean; previousLevel: number } {
  const previousLevel = level;
  let nextLevel = level;
  let nextExp = exp + gained;
  let leveledUp = false;

  while (nextExp >= expRequiredToLevelUp(nextLevel)) {
    nextExp -= expRequiredToLevelUp(nextLevel);
    nextLevel += 1;
    leveledUp = true;
  }

  return {
    level: nextLevel,
    exp: nextExp,
    leveledUp,
    previousLevel,
  };
}

function buildCelebrationReply(
  locale: LocaleCode,
  nickname: string,
  personality: string,
  leveledUp: boolean,
): string {
  if (leveledUp) {
    return formatPetCheckInCelebrationLevelUpReply(locale, { nickname });
  }
  return formatPetCheckInCelebrationReply(locale, personality, { nickname });
}

export async function grantPetExpOnCheckIn(
  userId: number,
  input: {
    hasPhoto: boolean;
    isFirstAtAttraction: boolean;
  },
  locale: LocaleCode,
): Promise<PetCheckInCelebration | null> {
  try {
    const petRow = await ensureTravelPet(userId);
    const expGained = computeCheckInPetExp(input);
    const applied = applyPetExpGain(petRow.level, petRow.exp, expGained);
    const nickname = petRow.nickname?.trim() || TRAVEL_PET_DEFAULT_NICKNAME;
    const personality = (petRow.personality ?? 'guide') as TravelPetPersonality;

    const db = getDb();
    await db
      .update(travelPets)
      .set({
        level: applied.level,
        exp: applied.exp,
        mood: 'excited',
      })
      .where(eq(travelPets.id, petRow.id));

    return {
      expGained,
      leveledUp: applied.leveledUp,
      previousLevel: applied.previousLevel,
      newLevel: applied.level,
      nickname,
      petReply: buildCelebrationReply(locale, nickname, personality, applied.leveledUp),
    };
  } catch (err) {
    console.warn(
      '[pet-exp] 打卡经验发放失败，跳过:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
