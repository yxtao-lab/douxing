import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/index.js';
import {
  buildMembershipInfo,
  getPlanCandidateCountByMemberLevel,
  normalizeMemberLevel,
  type MembershipInfo,
} from '@douxing/shared';

export async function getUserMemberLevel(userId: number): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ memberLevel: users.memberLevel })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return normalizeMemberLevel(rows[0]?.memberLevel);
}

export async function getPlanCandidateCountForUser(userId: number): Promise<number> {
  const level = await getUserMemberLevel(userId);
  return getPlanCandidateCountByMemberLevel(level);
}

export async function getMembershipInfoForUser(userId: number): Promise<MembershipInfo | null> {
  const db = getDb();
  const rows = await db
    .select({ memberLevel: users.memberLevel })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!rows[0]) return null;
  return buildMembershipInfo(rows[0].memberLevel);
}
