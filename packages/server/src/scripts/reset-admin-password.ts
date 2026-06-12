/**
 * 生产环境重置管理员密码（不经过 HTTP，避免弱口令在线修改时被截获）
 *
 * 用法（项目根目录）:
 *   pnpm --filter @douxing/server reset-admin-password -- --password '你的强密码'
 *   pnpm --filter @douxing/server reset-admin-password -- --username admin --password '你的强密码'
 *
 * 密码要求：至少 12 位，含大小写字母与数字（可含符号）
 */
import '../config/env.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { RoleCode } from '@douxing/shared';
import { validateAdminPassword } from '../utils/admin-password.util.js';
import { getDb } from '../db/client.js';
import { users, roles, userRoles } from '../db/schema/index.js';

function parseArgs(argv: string[]) {
  let username = 'admin';
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

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user) {
    console.error(`[reset-admin-password] 用户不存在: ${username}`);
    process.exit(1);
  }

  const roleRows = await db
    .select({ code: roles.code })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, user.id));

  if (!roleRows.some((row) => row.code === RoleCode.ADMIN)) {
    console.error(`[reset-admin-password] 用户 ${username} 不是管理员，已拒绝`);
    process.exit(1);
  }

  const hashed = await bcrypt.hash(password, 12);
  await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, user.id));

  console.log(`[reset-admin-password] 已更新管理员 ${username} 的密码（bcrypt cost=12）`);
}

main().catch((err) => {
  console.error('[reset-admin-password] 失败', err);
  process.exit(1);
});
