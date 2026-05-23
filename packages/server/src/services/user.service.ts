import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';
import type { UserInfo, UpdateUserProfileRequest } from '@douxing/shared';
import { USER_INTEREST_MAX, USER_INTEREST_PRESETS, normalizeMemberLevel } from '@douxing/shared';
import { rewritePublicAssetUrl, normalizeStoredAssetPath } from '../utils/public-asset-url.util.js';

const PRESET_SET = new Set<string>(USER_INTEREST_PRESETS);

function normalizeInterestTags(tags: string[] | undefined): string[] | undefined {
  if (tags === undefined) return undefined;
  const unique: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || unique.includes(tag)) continue;
    if (!PRESET_SET.has(tag)) {
      throw new Error(`不支持的标签：${tag}`);
    }
    unique.push(tag);
    if (unique.length > USER_INTEREST_MAX) {
      throw new Error(`兴趣标签最多 ${USER_INTEREST_MAX} 个`);
    }
  }
  return unique;
}

function mapUserRow(
  user: typeof users.$inferSelect,
  roleCodes: string[],
): UserInfo {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: rewritePublicAssetUrl(user.avatar),
    phone: user.phone,
    email: user.email,
    interestTags: user.interestTags ?? null,
    memberLevel: normalizeMemberLevel(user.memberLevel),
    status: user.status,
    roles: roleCodes,
  };
}

export async function findUserByUsername(username: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByPhone(phone: string) {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return rows[0] ?? null;
}

export async function getUserWithRoles(userId: number): Promise<UserInfo | null> {
  const db = getDb();
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return mapUserRow(user, roleRows.map((r) => r.code));
}

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
    if (!nickname) throw new Error('昵称不能为空');
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

  if (Object.keys(patch).length === 0) {
    return getUserWithRoles(userId);
  }

  await db.update(users).set(patch).where(eq(users.id, userId));
  return getUserWithRoles(userId);
}

export async function setUserAvatar(userId: number, avatar: string): Promise<UserInfo | null> {
  const db = getDb();
  const stored = normalizeStoredAssetPath(avatar) ?? avatar;
  await db.update(users).set({ avatar: stored }).where(eq(users.id, userId));
  return getUserWithRoles(userId);
}
