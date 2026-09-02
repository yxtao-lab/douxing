import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';
import type {
  UserInfo,
  UpdateUserProfileRequest,
  CompleteOnboardingRequest,
} from '@douxing/shared';
import {
  USER_INTEREST_MAX,
  USER_INTEREST_PRESETS,
  normalizeMemberLevel,
  getEffectiveMemberLevel,
  ApiError,
  ApiMessageKey,
  normalizeSceneTags,
  isGenderSlug,
  isAgeRangeSlug,
  isTravelRadiusSlug,
  isBudgetTierSlug,
  normalizeCompanionStructure,
  normalizeOnboardingInput,
} from '@douxing/shared';
import { rewritePublicAssetUrl, normalizeStoredAssetPath } from '../utils/public-asset-url.util.js';
import { getPermissionsForUser } from './permission.service.js';
import { syncMerchantRoleForUser } from './marketplace/marketplace-merchant-role.service.js';
import { formatDbDateTimeForApi } from '../utils/api-datetime.js';
import { refreshUserPersona } from './travel-persona.service.js';

const PRESET_SET = new Set<string>(USER_INTEREST_PRESETS);

/**
 * 规整兴趣标签列表；非法标签抛 ApiError。
 *
 * @param tags - 原始输入；undefined 表示不更新
 * @returns 合法且去重后的标签；undefined 表示不更新
 * @throws {ApiError} 非法标签或超过上限时
 */
function normalizeInterestTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  const unique: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || unique.includes(tag)) continue;
    if (!PRESET_SET.has(tag)) {
      throw new ApiError(ApiMessageKey.ONBOARDING_INVALID_FIELD, { field: 'interestTags' });
    }
    unique.push(tag);
    if (unique.length > USER_INTEREST_MAX) {
      throw new ApiError(ApiMessageKey.ONBOARDING_INVALID_FIELD, { field: 'interestTags' });
    }
  }
  return unique;
}

/**
 * 规整用户偏好场景标签（P-TAG-01）。
 *
 * @param tags - 原始输入；undefined 表示不更新
 * @returns 合法且去重后的 slug 数组；undefined 表示不更新
 */
function normalizePreferredScenes(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  return normalizeSceneTags(tags);
}

/**
 * 将 users 行映射为 UserInfo（含 P-ONBOARD-01 画像字段）。
 *
 * @param user - DB 用户行
 * @param roleCodes - 角色 code 列表
 * @param permissions - 权限标识列表
 * @returns API 用 UserInfo
 */
function mapUserRow(
  user: typeof users.$inferSelect,
  roleCodes: string[],
  permissions: string[],
): UserInfo {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: rewritePublicAssetUrl(user.avatar),
    phone: user.phone,
    email: user.email,
    interestTags: user.interestTags ?? null,
    preferredScenes: user.preferredScenes ?? null,
    gender: user.gender ?? null,
    ageRange: user.ageRange ?? null,
    travelRadius: user.travelRadius ?? null,
    companionStructure: user.companionStructure ?? null,
    budgetTier: user.budgetTier ?? null,
    onboardedAt: user.onboardedAt ? formatDbDateTimeForApi(user.onboardedAt) : null,
    // C 端展示/权益一律用有效等级（过期后降为免费），与 /users/me/membership 一致
    memberLevel: getEffectiveMemberLevel(user.memberLevel, user.memberExpiresAt),
    status: user.status,
    roles: roleCodes,
    permissions,
  };
}

/**
 * 按用户名查找用户行。
 *
 * @param username - 登录名
 * @returns 用户行或 null
 */
export async function findUserByUsername(username: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

/**
 * 按手机号查找用户行。
 *
 * @param phone - 手机号
 * @returns 用户行或 null
 */
export async function findUserByPhone(phone: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return rows[0] ?? null;
}

/**
 * 获取带角色与权限的用户资料。
 *
 * @param userId - 用户 ID
 * @returns UserInfo；用户不存在时返回 null
 */
export async function getUserWithRoles(userId: number): Promise<UserInfo | null> {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  await syncMerchantRoleForUser(userId);

  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  const roleCodes = roleRows.map((r) => r.code);
  const permissions = await getPermissionsForUser(userId);
  return mapUserRow(user, roleCodes, permissions);
}

/**
 * 更新当前用户资料（含 P-ONBOARD-01 画像字段，不自动设 onboardedAt）。
 *
 * @param userId - 用户 ID
 * @param input - 待更新字段；未传字段不改
 * @returns 更新后的 UserInfo；用户不存在返回 null
 * @throws {ApiError} 昵称为空或枚举字段非法时
 */
export async function updateUserProfile(
  userId: number,
  input: UpdateUserProfileRequest,
): Promise<UserInfo | null> {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const existing = userRows[0];
  if (!existing) return null;

  const patch: Partial<typeof users.$inferInsert> = {};

  if (input.nickname !== undefined) {
    const nickname = input.nickname.trim();
    if (!nickname) throw new ApiError(ApiMessageKey.NICKNAME_REQUIRED);
    patch.nickname = nickname;
  }

  if (input.avatar !== undefined) {
    patch.avatar =
      input.avatar === null ? null : normalizeStoredAssetPath(input.avatar) ?? input.avatar;
  }

  if (input.email !== undefined) {
    patch.email = input.email;
  }

  if (input.interestTags !== undefined) {
    patch.interestTags = normalizeInterestTags(input.interestTags);
  }

  if (input.preferredScenes !== undefined) {
    patch.preferredScenes = normalizePreferredScenes(input.preferredScenes);
  }

  if (input.gender !== undefined) {
    if (input.gender === null || input.gender === '') {
      patch.gender = null;
    } else if (!isGenderSlug(input.gender)) {
      throw new ApiError(ApiMessageKey.ONBOARDING_INVALID_FIELD, { field: 'gender' });
    } else {
      patch.gender = input.gender;
    }
  }

  if (input.ageRange !== undefined) {
    if (input.ageRange === null || input.ageRange === '') {
      patch.ageRange = null;
    } else if (!isAgeRangeSlug(input.ageRange)) {
      throw new ApiError(ApiMessageKey.ONBOARDING_INVALID_FIELD, { field: 'ageRange' });
    } else {
      patch.ageRange = input.ageRange;
    }
  }

  if (input.travelRadius !== undefined) {
    if (input.travelRadius === null || input.travelRadius === '') {
      patch.travelRadius = null;
    } else if (!isTravelRadiusSlug(input.travelRadius)) {
      throw new ApiError(ApiMessageKey.ONBOARDING_INVALID_FIELD, { field: 'travelRadius' });
    } else {
      patch.travelRadius = input.travelRadius;
    }
  }

  if (input.companionStructure !== undefined) {
    patch.companionStructure = normalizeCompanionStructure(input.companionStructure);
  }

  if (input.budgetTier !== undefined) {
    if (input.budgetTier === null || input.budgetTier === '') {
      patch.budgetTier = null;
    } else if (!isBudgetTierSlug(input.budgetTier)) {
      throw new ApiError(ApiMessageKey.ONBOARDING_INVALID_FIELD, { field: 'budgetTier' });
    } else {
      patch.budgetTier = input.budgetTier;
    }
  }

  if (Object.keys(patch).length === 0) {
    return getUserWithRoles(userId);
  }

  await db.update(users).set(patch).where(eq(users.id, userId));
  return getUserWithRoles(userId);
}

/**
 * 完成首次标签引导：写入画像字段、标记 onboardedAt，并刷新旅行人格。
 *
 * @param userId - 用户 ID
 * @param input - 引导选择；skipped=true 时用默认值
 * @returns 更新后的 UserInfo；用户不存在返回 null
 */
export async function completeUserOnboarding(
  userId: number,
  input: CompleteOnboardingRequest,
): Promise<UserInfo | null> {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRows[0]) return null;

  const normalized = normalizeOnboardingInput(input);
  const interestTags =
    normalized.interestTags != null
      ? normalizeInterestTags(normalized.interestTags)
      : undefined;

  const patch: Partial<typeof users.$inferInsert> = {
    gender: normalized.gender,
    ageRange: normalized.ageRange,
    travelRadius: normalized.travelRadius,
    preferredScenes: normalized.preferredScenes,
    companionStructure:
      normalized.companionStructure.length > 0 ? normalized.companionStructure : null,
    budgetTier: normalized.budgetTier,
    onboardedAt: new Date(),
  };
  if (interestTags !== undefined) {
    patch.interestTags = interestTags;
  }

  await db.update(users).set(patch).where(eq(users.id, userId));

  try {
    await refreshUserPersona(userId);
  } catch (err) {
    console.warn('[completeUserOnboarding] persona refresh failed', err);
  }

  return getUserWithRoles(userId);
}

/**
 * 更新用户头像路径。
 *
 * @param userId - 用户 ID
 * @param avatar - 存储路径或 URL
 * @returns 更新后的 UserInfo；用户不存在返回 null
 */
export async function setUserAvatar(userId: number, avatar: string): Promise<UserInfo | null> {
  const db = getDb();
  const stored = normalizeStoredAssetPath(avatar) ?? avatar;
  await db.update(users).set({ avatar: stored }).where(eq(users.id, userId));
  return getUserWithRoles(userId);
}
