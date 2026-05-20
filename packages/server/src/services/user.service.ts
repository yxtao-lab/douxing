import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';
import type { UserInfo } from '@douxing/shared';

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

  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    phone: user.phone,
    email: user.email,
    status: user.status,
    roles: roleRows.map((r) => r.code),
  };
}
