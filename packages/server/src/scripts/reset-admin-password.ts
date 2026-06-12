/**
 * 生产环境重置/修复管理员账号（不经过 HTTP）
 *
 * 用法（项目根目录）:
 *   pnpm --filter @douxing/server reset-admin-password -- --password '你的强密码'
 *   pnpm --filter @douxing/server reset-admin-password -- --username admin --password '你的强密码'
 *
 * 若用户存在但未绑定 admin 角色，会自动补绑（常见于早期 seed 不完整）。
 * 若用户不存在，会创建管理员账号。
 *
 * 密码要求：至少 12 位，含大小写字母与数字（可含符号）
 */
import '../config/env.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { RoleCode, MemberLevel, UserType } from '@douxing/shared';
import {
  readAdminInitialUsername,
  validateAdminPassword,
} from '../utils/admin-password.util.js';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';

function parseArgs(argv: string[]) {
  let username = readAdminInitialUsername();
  let password = '';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--username' && argv[i + 1]) {
      username = argv[i + 1]!;
      i += 1;
      continue;
    }
    if (arg === '--password' && argv[i + 1]) {
      password = argv[i + 1]!;
      i += 1;
    }
  }

  return { username, password };
}

async function ensureAdminRoleExists() {
  const db = getDb();
  const existing = await db.select().from(roles).where(eq(roles.code, RoleCode.ADMIN)).limit(1);
  if (existing.length > 0) return existing[0]!.id;

  const [result] = await db.insert(roles).values({
    code: RoleCode.ADMIN,
    name: '管理员',
    description: '系统管理员',
  });
  console.log('[reset-admin-password] 已创建 admin 角色');
  return Number(result.insertId);
}

async function userHasAdminRole(userId: number): Promise<boolean> {
  const db = getDb();
  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));
  return roleRows.some((row) => row.code === RoleCode.ADMIN);
}

async function ensureUserAdminRole(userId: number): Promise<void> {
  if (await userHasAdminRole(userId)) return;

  const db = getDb();
  const adminRoleId = await ensureAdminRoleExists();
  await db.insert(userRoles).values({ userId, roleId: adminRoleId });
  console.log('[reset-admin-password] 已为用户补绑 admin 角色');
}

async function findOrCreateAdminUser(username: string): Promise<number> {
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    if (existing.status !== 1) {
      await db.update(users).set({ status: 1 }).where(eq(users.id, existing.id));
      console.log(`[reset-admin-password] 已启用用户 ${username}`);
    }
    await ensureUserAdminRole(existing.id);
    return existing.id;
  }

  const adminRoleId = await ensureAdminRoleExists();
  const [result] = await db.insert(users).values({
    username,
    passwordHash: '',
    nickname: '系统管理员',
    email: `${username}@douxing.com`,
    userType: UserType.NORMAL,
    memberLevel: MemberLevel.VIP,
    status: 1,
  });
  const userId = Number(result.insertId);
  await db.insert(userRoles).values({ userId, roleId: adminRoleId });
  console.log(`[reset-admin-password] 已创建管理员用户 ${username}`);
  return userId;
}

async function main() {
  const { username, password } = parseArgs(process.argv.slice(2));

  if (!password) {
    console.error(
      '用法: pnpm --filter @douxing/server reset-admin-password -- --password \'强密码\' [--username admin]',
    );
    process.exit(1);
  }

  const validationError = validateAdminPassword(password);
  if (validationError) {
    console.error(`[reset-admin-password] ${validationError}`);
    process.exit(1);
  }

  const userId = await findOrCreateAdminUser(username);
  const hashed = await bcrypt.hash(password, 12);
  await getDb().update(users).set({ passwordHash: hashed }).where(eq(users.id, userId));

  console.log(`[reset-admin-password] 已更新管理员 ${username} 的密码（bcrypt cost=12）`);
}

main().catch((err) => {
  console.error('[reset-admin-password] 失败', err);
  process.exit(1);
});
