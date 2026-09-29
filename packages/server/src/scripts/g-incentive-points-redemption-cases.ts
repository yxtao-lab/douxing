/**
 * G-INCENTIVE-01 · 验证积分兑换验收
 *
 * 用法：
 *   pnpm --filter @douxing/shared build
 *   pnpm --filter @douxing/server db:migrate
 *   pnpm --filter @douxing/server g-incentive:points-redemption-cases
 */
import '../config/env.js';
import { eq } from 'drizzle-orm';
import {
  ApiError,
  ApiMessageKey,
  MemberLevel,
  POINT_REDEMPTION_CATALOG,
  PointRedemptionProductId,
  PHOTO_QUOTA_PACK_BYTES,
  getPhotoQuotaByMemberLevel,
  getPlanCandidateCountByMemberLevel,
  getPointRedemptionProduct,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/users.js';
import { pointRedemptions } from '../db/schema/point-redemptions.js';
import { verificationPointEvents } from '../db/schema/verification-point-events.js';
import { getPlanCandidateCountForUser, getUserMemberLevel } from '../services/membership.service.js';
import { getUserPhotoStorageInfo } from '../services/photo-quota.service.js';
import {
  getPointRedemptionEntitlements,
  listPointRedemptionCatalog,
  redeemPointsProduct,
} from '../services/points-redemption.service.js';
import {
  creditVerificationPoints,
} from '../services/verification-points.service.js';

let failed = 0;

/**
 * 断言条件为真，失败时累计失败计数并打印标签。
 *
 * @param condition - 期望为真的条件
 * @param label - 用例描述
 */
function assert(condition: boolean, label: string) {
  if (!condition) {
    failed += 1;
    console.error(`[FAIL] ${label}`);
  } else {
    console.log(`[OK] ${label}`);
  }
}

/**
 * 校验兑换目录常量。
 */
function checkSharedCatalog() {
  console.log('--- shared 兑换目录 ---');
  assert(POINT_REDEMPTION_CATALOG.length >= 4, '目录至少含 4 种权益');
  const ai = getPointRedemptionProduct(PointRedemptionProductId.AI_PLAN_PACK);
  const photo = getPointRedemptionProduct(PointRedemptionProductId.PHOTO_QUOTA_PACK);
  assert(ai?.costPoints === 50 && ai.grantPlanCandidates === 1, '规划包 50 分/+1 候选');
  assert(
    photo?.costPoints === 40 &&
      photo.grantPhotoCount === 100 &&
      photo.grantPhotoBytes === PHOTO_QUOTA_PACK_BYTES,
    '相册包 40 分/+100 张/+200MB',
  );
  console.log('');
}

/**
 * 校验迁移字段可读。
 */
async function checkColumns() {
  console.log('--- 表结构 ---');
  const db = getDb();
  try {
    await db
      .select({
        bonusPlanCandidates: users.bonusPlanCandidates,
        bonusPhotoCount: users.bonusPhotoCount,
        bonusPhotoBytes: users.bonusPhotoBytes,
        posterStickerUnlocked: users.posterStickerUnlocked,
      })
      .from(users)
      .limit(1);
    assert(true, 'users 兑换权益字段可读');
  } catch (err) {
    assert(false, `users 权益字段: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    await db.select({ id: pointRedemptions.id }).from(pointRedemptions).limit(1);
    assert(true, 'point_redemptions 可读');
  } catch (err) {
    assert(false, `point_redemptions: ${err instanceof Error ? err.message : String(err)}`);
  }
  console.log('');
}

/**
 * 端到端兑换：规划候选、相册配额、余额不足、上限、贴纸。
 */
async function checkRedemptionFlow() {
  console.log('--- 兑换主链 ---');
  const db = getDb();
  const demo = await db.select().from(users).where(eq(users.username, 'demo')).limit(1);
  const userId = demo[0]?.id;
  assert(userId != null, 'demo 用户存在');
  if (userId == null) return;

  const snapshot = {
    verificationPoints: demo[0]!.verificationPoints,
    bonusPlanCandidates: demo[0]!.bonusPlanCandidates,
    bonusPhotoCount: demo[0]!.bonusPhotoCount,
    bonusPhotoBytes: demo[0]!.bonusPhotoBytes,
    posterStickerUnlocked: demo[0]!.posterStickerUnlocked,
    memberLevel: demo[0]!.memberLevel,
    memberExpiresAt: demo[0]!.memberExpiresAt,
  };

  const createdDedupeKeys: string[] = [];
  const stamp = Date.now();

  // 隔离用例：重置权益与余额，不删他人历史账本（结束时恢复快照并清理本用例键）
  await db
    .update(users)
    .set({
      verificationPoints: 200,
      bonusPlanCandidates: 0,
      bonusPhotoCount: 0,
      bonusPhotoBytes: 0,
      posterStickerUnlocked: 0,
      memberLevel: MemberLevel.FREE,
      memberExpiresAt: null,
    })
    .where(eq(users.id, userId));

  const basePlan = getPlanCandidateCountByMemberLevel(MemberLevel.FREE);
  assert(
    (await getPlanCandidateCountForUser(userId)) === basePlan,
    '兑换前规划候选=免费基础值',
  );

  const aiReq = `case-ai-${stamp}`;
  const aiResult = await redeemPointsProduct(
    userId,
    PointRedemptionProductId.AI_PLAN_PACK,
    aiReq,
  );
  createdDedupeKeys.push(`vp:redeem:${userId}:ai_plan_pack:${aiReq}`);
  assert(aiResult.pointsSpent === 50, '规划包扣 50 分');
  assert(aiResult.entitlements.bonusPlanCandidates === 1, '规划候选加成 +1');
  assert(
    (await getPlanCandidateCountForUser(userId)) === basePlan + 1,
    '规划候选生效到 getPlanCandidateCountForUser',
  );

  const baseQuota = getPhotoQuotaByMemberLevel(MemberLevel.FREE);
  const photoReq = `case-photo-${stamp}`;
  const photoResult = await redeemPointsProduct(
    userId,
    PointRedemptionProductId.PHOTO_QUOTA_PACK,
    photoReq,
  );
  createdDedupeKeys.push(`vp:redeem:${userId}:photo_quota_pack:${photoReq}`);
  assert(photoResult.pointsSpent === 40, '相册包扣 40 分');
  const afterStorage = await getUserPhotoStorageInfo(userId);
  assert(afterStorage.maxCount === baseQuota.maxCount + 100, '相册张数配额生效');
  assert(
    afterStorage.maxBytes === baseQuota.maxBytes + PHOTO_QUOTA_PACK_BYTES,
    '相册字节配额生效',
  );

  let insufficient = false;
  try {
    await db.update(users).set({ verificationPoints: 10 }).where(eq(users.id, userId));
    await redeemPointsProduct(userId, PointRedemptionProductId.AI_PLAN_PACK, `case-poor-${stamp}`);
  } catch (err) {
    insufficient =
      err instanceof ApiError && err.messageKey === ApiMessageKey.POINTS_REDEMPTION_INSUFFICIENT;
  }
  assert(insufficient, '余额不足拒绝兑换');

  const grantKey2 = `g-incentive:grant2:${userId}:${stamp}`;
  await creditVerificationPoints({
    userId,
    eventType: 'test_grant',
    points: 100,
    dedupeKey: grantKey2,
  });
  createdDedupeKeys.push(grantKey2);

  const stickerReq = `case-sticker-${stamp}`;
  const sticker = await redeemPointsProduct(
    userId,
    PointRedemptionProductId.POSTER_STICKER,
    stickerReq,
  );
  createdDedupeKeys.push(`vp:redeem:${userId}:poster_sticker:${stickerReq}`);
  assert(sticker.entitlements.posterStickerUnlocked, '贴纸解锁');
  let alreadyOwned = false;
  try {
    await redeemPointsProduct(
      userId,
      PointRedemptionProductId.POSTER_STICKER,
      `case-sticker2-${stamp}`,
    );
  } catch (err) {
    alreadyOwned =
      err instanceof ApiError && err.messageKey === ApiMessageKey.POINTS_REDEMPTION_ALREADY_OWNED;
  }
  assert(alreadyOwned, '贴纸不可重复兑换');

  const catalog = await listPointRedemptionCatalog(userId);
  assert(catalog.some((item) => item.id === PointRedemptionProductId.AI_PLAN_PACK), '目录含规划包');
  const entitlements = await getPointRedemptionEntitlements(userId);
  assert(entitlements.bonusPlanCandidates >= 1, '权益快照可读');

  await db
    .update(users)
    .set({
      verificationPoints: 200,
      memberLevel: MemberLevel.FREE,
      memberExpiresAt: null,
    })
    .where(eq(users.id, userId));
  const memberReq = `case-member-${stamp}`;
  const trial = await redeemPointsProduct(
    userId,
    PointRedemptionProductId.MEMBER_TRIAL_SILVER,
    memberReq,
  );
  createdDedupeKeys.push(`vp:redeem:${userId}:member_trial_silver:${memberReq}`);
  assert(trial.pointsSpent === 120, '会员体验扣 120 分');
  assert((await getUserMemberLevel(userId)) >= MemberLevel.SILVER, '兑换后至少白银');

  let memberBlock = false;
  try {
    const grantKey3 = `g-incentive:grant3:${userId}:${stamp}`;
    await creditVerificationPoints({
      userId,
      eventType: 'test_grant',
      points: 200,
      dedupeKey: grantKey3,
    });
    createdDedupeKeys.push(grantKey3);
    await redeemPointsProduct(
      userId,
      PointRedemptionProductId.MEMBER_TRIAL_SILVER,
      `case-member2-${stamp}`,
    );
  } catch (err) {
    memberBlock =
      err instanceof ApiError &&
      err.messageKey === ApiMessageKey.POINTS_REDEMPTION_MEMBER_NOT_ELIGIBLE;
  }
  assert(memberBlock, '已是白银及以上不可再兑体验包');

  for (const key of createdDedupeKeys) {
    await db.delete(verificationPointEvents).where(eq(verificationPointEvents.dedupeKey, key));
  }
  await db.delete(pointRedemptions).where(eq(pointRedemptions.userId, userId));
  await db
    .update(users)
    .set({
      verificationPoints: snapshot.verificationPoints,
      bonusPlanCandidates: snapshot.bonusPlanCandidates,
      bonusPhotoCount: snapshot.bonusPhotoCount,
      bonusPhotoBytes: snapshot.bonusPhotoBytes,
      posterStickerUnlocked: snapshot.posterStickerUnlocked,
      memberLevel: snapshot.memberLevel,
      memberExpiresAt: snapshot.memberExpiresAt,
    })
    .where(eq(users.id, userId));

  console.log('');
}

async function main() {
  console.log('=== G-INCENTIVE-01 积分兑换验收 ===\n');
  checkSharedCatalog();
  await checkColumns();
  await checkRedemptionFlow();

  if (failed > 0) {
    console.error(`\nG-INCENTIVE-01 验收失败：${failed} 项未通过`);
    process.exit(1);
  }
  console.log('\nG-INCENTIVE-01 验收通过');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
