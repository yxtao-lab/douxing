/**
 * H3-d · Step 34 行中宠物 + 打卡成长验收
 *
 * 用法：
 *   pnpm --filter @douxing/server h3-d:in-trip-cases
 *   pnpm --filter @douxing/server h3-d:in-trip-cases -- --skip-db
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import {
  PET_CHECKIN_EXP_BASE,
  PET_CHECKIN_EXP_FIRST_BONUS,
  PET_CHECKIN_EXP_PHOTO_BONUS,
  formatPetAnalyzeSceneLabel,
  formatPetCheckInCelebrationExp,
  formatPetCheckInCelebrationTitle,
  isPetAnalyzeScene,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { travelPets } from '../db/schema/travel-pets.js';
import { travelRoutes } from '../db/schema/travel-routes.js';
import { users } from '../db/schema/users.js';
import { analyzeTravelPet } from '../services/pet-analyze.service.js';
import { clearCachedPetAnalyze } from '../services/pet-analyze-cache.service.js';
import {
  applyPetExpGain,
  computeCheckInPetExp,
  expRequiredToLevelUp,
  grantPetExpOnCheckIn,
} from '../services/pet-exp.service.js';
import { deleteTravelPetForUser } from '../services/travel-pet.service.js';

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

function checkExpRulesOffline() {
  console.log('--- 打卡经验规则（无 DB）---');
  assert(computeCheckInPetExp({ hasPhoto: false, isFirstAtAttraction: false }) === PET_CHECKIN_EXP_BASE, '基础经验');
  assert(
    computeCheckInPetExp({ hasPhoto: true, isFirstAtAttraction: true }) ===
      PET_CHECKIN_EXP_BASE + PET_CHECKIN_EXP_PHOTO_BONUS + PET_CHECKIN_EXP_FIRST_BONUS,
    '照片+首打卡加成',
  );
  assert(expRequiredToLevelUp(1) === 100, 'Lv1 升级阈值 100');

  const leveled = applyPetExpGain(1, 90, 20);
  assert(leveled.leveledUp && leveled.level === 2 && leveled.exp === 10, '90+20 升级 Lv2 余 10');

  const zhTitle = formatPetCheckInCelebrationTitle('zh-CN');
  const enExp = formatPetCheckInCelebrationExp('en-US', { exp: 15 });
  assert(zhTitle.length > 0 && enExp.includes('15'), '庆祝文案 i18n');
  console.log('');
}

function checkAnalyzeScenesOffline() {
  console.log('--- in_trip / in_plan 场景（无 DB）---');
  assert(isPetAnalyzeScene('in_trip'), 'in_trip 合法');
  assert(isPetAnalyzeScene('in_plan'), 'in_plan 合法');
  assert(formatPetAnalyzeSceneLabel('in_trip', 'zh-CN').includes('行中'), 'in_trip zh 标签');
  assert(formatPetAnalyzeSceneLabel('in_plan', 'en-US').toLowerCase().includes('plan'), 'in_plan en 标签');
  console.log('');
}

async function resolveTestUserAndRoute(): Promise<{ userId: number; routeId: number } | null> {
  const db = getDb();
  const userRows = await db.select({ id: users.id }).from(users).limit(1);
  const userId = userRows[0]?.id;
  if (!userId) return null;

  const routeRows = await db
    .select({ id: travelRoutes.id })
    .from(travelRoutes)
    .where(eq(travelRoutes.creatorId, userId))
    .limit(1);
  const routeId = routeRows[0]?.id;
  if (!routeId) return null;
  return { userId, routeId };
}

async function checkDbIntegration() {
  if (skipDb) {
    console.log('--- DB 集成（跳过 --skip-db）---\n');
    return;
  }

  console.log('--- DB 集成：exp + in_trip analyze ---');
  try {
    const pair = await resolveTestUserAndRoute();
    if (!pair) {
      console.log('[SKIP] 无用户/路线');
      console.log('');
      return;
    }

    const db = getDb();
    await deleteTravelPetForUser(pair.userId).catch(() => undefined);
    await db.delete(travelPets).where(eq(travelPets.userId, pair.userId));

    const celebration = await grantPetExpOnCheckIn(
      pair.userId,
      { hasPhoto: true, isFirstAtAttraction: false },
      'zh-CN',
    );
    assert(Boolean(celebration?.expGained && celebration.petReply), 'grantPetExpOnCheckIn 返回庆祝');

    const petRows = await db
      .select({ exp: travelPets.exp, level: travelPets.level, mood: travelPets.mood })
      .from(travelPets)
      .where(eq(travelPets.userId, pair.userId))
      .limit(1);
    assert((petRows[0]?.exp ?? 0) > 0, '宠物 exp 已写入');
    assert(petRows[0]?.mood === 'excited', '打卡后 mood=excited');

    await clearCachedPetAnalyze(pair.userId, 'in_trip', pair.routeId);
    const inTrip = await analyzeTravelPet(
      pair.userId,
      { scene: 'in_trip', routeId: pair.routeId },
      'zh-CN',
      { skipCache: true },
    );
    assert(inTrip.scene === 'in_trip' && Boolean(inTrip.insight && inTrip.petReply), 'in_trip analyze');

    const inPlan = await analyzeTravelPet(
      pair.userId,
      { scene: 'in_plan' },
      'en-US',
      { skipCache: true },
    );
    assert(inPlan.scene === 'in_plan' && Boolean(inPlan.petReply), 'in_plan analyze');
  } catch (err) {
    failed += 1;
    console.error('[FAIL] DB 集成异常:', err);
  }
  console.log('');
}

async function main() {
  console.log('H3-d in-trip cases\n');
  checkExpRulesOffline();
  checkAnalyzeScenesOffline();
  await checkDbIntegration();

  if (failed > 0) {
    console.error(`\n${failed} 项失败`);
    process.exit(1);
  }
  console.log('\n全部通过');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
