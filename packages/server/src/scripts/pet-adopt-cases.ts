/**
 * H3-a · Step 25 旅行宠物领养 API 验收
 *
 * 用法：
 *   pnpm --filter @douxing/server pet:adopt-cases
 *   pnpm --filter @douxing/server pet:adopt-cases -- --skip-db
 */
import '../config/env.js';
import {
  ApiError,
  ApiMessageKey,
  TRAVEL_PET_PERSONALITIES,
  TRAVEL_PET_SPECIES,
  resolveApiMessage,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { ensureTravelPet } from '../services/pet-memory.service.js';
import {
  adoptTravelPet,
  deleteTravelPetForUser,
  getTravelPetByUserId,
  isDefaultAutoTravelPet,
  updateTravelPetProfile,
} from '../services/travel-pet.service.js';

const skipDb = process.argv.includes('--skip-db');
let failed = 0;

function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

function checkSharedConstants() {
  console.log('--- 物种与人格枚举 ---');
  assert(TRAVEL_PET_SPECIES.length >= 3, '至少 3 种 species');
  assert(TRAVEL_PET_PERSONALITIES.length >= 4, '至少 4 种 personality');
  console.log('');
}

function checkI18n() {
  console.log('--- API i18n ---');
  const keys = [
    ApiMessageKey.PET_ADOPT_SUCCESS,
    ApiMessageKey.PET_ALREADY_ADOPTED,
    ApiMessageKey.PET_NOT_FOUND,
    ApiMessageKey.PET_UPDATE_SUCCESS,
    ApiMessageKey.PET_INVALID_SPECIES,
    ApiMessageKey.PET_INVALID_PERSONALITY,
  ] as const;

  for (const key of keys) {
    const zh = resolveApiMessage(key, 'zh-CN');
    const en = resolveApiMessage(key, 'en-US');
    assert(zh.length > 0 && zh !== key, `zh-CN ${key}`);
    assert(en.length > 0 && en !== key, `en-US ${key}`);
  }
  console.log('');
}

async function resolveTestUserId(): Promise<number | null> {
  const db = getDb();
  const rows = await db.select({ id: users.id }).from(users).limit(1);
  return rows[0]?.id ?? null;
}

async function checkAdoptFlow(userId: number) {
  console.log('--- 领养 / 查询 / 更新 ---');
  await deleteTravelPetForUser(userId);

  const adopted = await adoptTravelPet(userId, {
    species: 'cat',
    nickname: '咪咪',
    personality: 'foodie',
  });
  assert(adopted.species === 'cat', '领养写入 species=cat');
  assert(adopted.nickname === '咪咪', '领养写入 nickname');
  assert(adopted.personality === 'foodie', '领养写入 personality=foodie');

  const loaded = await getTravelPetByUserId(userId);
  assert(loaded?.id === adopted.id, 'getTravelPetByUserId 可读');

  let duplicateFailed = false;
  try {
    await adoptTravelPet(userId, {
      species: 'fox',
      nickname: '重复',
      personality: 'guide',
    });
  } catch (err) {
    duplicateFailed =
      err instanceof ApiError && err.messageKey === ApiMessageKey.PET_ALREADY_ADOPTED;
  }
  assert(duplicateFailed, '重复领养抛出 PET_ALREADY_ADOPTED');

  const updated = await updateTravelPetProfile(userId, { nickname: '旅行喵' });
  assert(updated.nickname === '旅行喵', 'PATCH 可改 nickname');

  await deleteTravelPetForUser(userId);
  console.log('');
}

async function checkDefaultAutoUpgrade(userId: number) {
  console.log('--- 懒创建默认宠可正式领养 ---');
  await deleteTravelPetForUser(userId);
  const auto = await ensureTravelPet(userId);
  assert(isDefaultAutoTravelPet(auto), 'ensureTravelPet 为默认宠');

  const adopted = await adoptTravelPet(userId, {
    species: 'panda',
    nickname: '团子',
    personality: 'family',
  });
  assert(adopted.species === 'panda', '默认宠可被正式领养覆盖 species');
  assert(adopted.nickname === '团子', '默认宠可被正式领养覆盖 nickname');

  await deleteTravelPetForUser(userId);
  console.log('');
}

async function checkValidation(userId: number) {
  console.log('--- 非法参数 ---');
  await deleteTravelPetForUser(userId);

  let invalidSpecies = false;
  try {
    await adoptTravelPet(userId, {
      species: 'dragon' as 'fox',
      nickname: '测试',
      personality: 'guide',
    });
  } catch (err) {
    invalidSpecies =
      err instanceof ApiError && err.messageKey === ApiMessageKey.PET_INVALID_SPECIES;
  }
  assert(invalidSpecies, '非法 species 抛出 PET_INVALID_SPECIES');

  let notFound = false;
  try {
    await updateTravelPetProfile(userId, { nickname: '无人' });
  } catch (err) {
    notFound = err instanceof ApiError && err.messageKey === ApiMessageKey.PET_NOT_FOUND;
  }
  assert(notFound, '无宠时 PATCH 抛出 PET_NOT_FOUND');

  console.log('');
}

async function main(): Promise<void> {
  console.log('=== H3-a 旅行宠物领养 API 验收（Step 25）===\n');

  checkSharedConstants();
  checkI18n();

  if (skipDb) {
    console.log('--- DB 用例 ---');
    console.log('[SKIP] --skip-db 已跳过\n');
  } else {
    try {
      const userId = await resolveTestUserId();
      if (!userId) {
        failed += 1;
        console.error('[FAIL] 数据库无用户，无法跑 DB 用例\n');
      } else {
        await checkAdoptFlow(userId);
        await checkDefaultAutoUpgrade(userId);
        await checkValidation(userId);
        await deleteTravelPetForUser(userId).catch(() => undefined);
      }
    } catch (err) {
      failed += 1;
      console.error('[FAIL] DB 用例异常:', err instanceof Error ? err.message : err);
      console.error('提示：需 MySQL 可用；无 DB 时使用 --skip-db\n');
    }
  }

  if (failed > 0) {
    console.error(`Step 25 验收失败：${failed} 项未通过`);
    process.exit(1);
  }

  console.log('=== Step 25 验收全部通过 ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('[pet-adopt-cases] 运行失败:', err);
  process.exit(1);
});
