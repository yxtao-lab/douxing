import '../config/env.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { ensureDatabase } from './ensure-database.js';
import { getDb } from './client.js';
import { users, roles, userRoles, systemConfig, travelRoutes } from './schema/index.js';
import { RouteStatus } from '@douxing/shared';
import { RoleCode, UserType } from '@douxing/shared';

async function seedRoles() {
  const db = getDb();
  const roleList = [
    { code: RoleCode.ADMIN, name: '管理员', description: '系统管理员' },
    { code: RoleCode.USER, name: '普通用户', description: '普通注册用户' },
  ];

  for (const role of roleList) {
    const existing = await db.select().from(roles).where(eq(roles.code, role.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(roles).values(role);
      console.log(`[seed] Created role: ${role.code}`);
    }
  }
}

async function seedAdminUser() {
  const db = getDb();
  const username = 'admin';
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (existing.length > 0) {
    console.log('[seed] Admin user already exists, skip');
    return;
  }

  const hashed = await bcrypt.hash('admin123', 10);
  const [result] = await db.insert(users).values({
    username,
    passwordHash: hashed,
    nickname: '系统管理员',
    email: 'admin@douxing.com',
    userType: UserType.NORMAL,
    status: 1,
  });

  const adminRole = await db.select().from(roles).where(eq(roles.code, RoleCode.ADMIN)).limit(1);
  if (adminRole[0] && result.insertId) {
    await db.insert(userRoles).values({
      userId: Number(result.insertId),
      roleId: adminRole[0].id,
    });
  }

  console.log('[seed] Created admin user (username: admin, password: admin123)');
}

async function seedDemoUser() {
  const db = getDb();
  const username = 'demo';
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Demo user already exists, skip');
    return existing[0]!.id;
  }

  const hashed = await bcrypt.hash('demo123', 10);
  const [result] = await db.insert(users).values({
    username,
    passwordHash: hashed,
    nickname: '体验用户',
    email: 'demo@douxing.com',
    userType: UserType.NORMAL,
    status: 1,
  });

  const userId = Number(result.insertId);
  const userRole = await db.select().from(roles).where(eq(roles.code, RoleCode.USER)).limit(1);
  if (userRole[0]) {
    await db.insert(userRoles).values({ userId, roleId: userRole[0].id });
  }
  console.log('[seed] Created demo user (username: demo, password: demo123)');
  return userId;
}

async function seedSampleRoutes(creatorId: number) {
  const db = getDb();
  const existing = await db.select().from(travelRoutes).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Sample routes already exist, skip');
    return;
  }

  await db.insert(travelRoutes).values({
    name: '杭州西湖经典一日游',
    description: '适合周末短途，含西湖核心景点。',
    budgetRange: '500-1000',
    days: 1,
    interestTags: ['文化', '自然'],
    routeDetail: {
      days: [
        {
          date: '第1天',
          title: '西湖环线',
          attractions: [
            { name: '断桥', time: '09:00-10:30', cost: 0, description: '西湖标志' },
            { name: '苏堤', time: '11:00-13:00', cost: 0, description: '漫步赏景' },
          ],
        },
      ],
      isAiGenerated: false,
      unlockPrice: 0,
      isUnlocked: true,
    },
    creatorId,
    status: RouteStatus.PUBLISHED,
  });
  console.log('[seed] Created sample travel route');
}

async function seedSystemConfig() {
  const db = getDb();
  const configs = [
    { configKey: 'app_name', configValue: '兜行', remark: '应用名称' },
    { configKey: 'app_version', configValue: '1.0.0', remark: '应用版本' },
    { configKey: 'maintenance_mode', configValue: 'false', remark: '维护模式' },
  ];

  for (const cfg of configs) {
    const existing = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.configKey, cfg.configKey))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(systemConfig).values(cfg);
      console.log(`[seed] Created config: ${cfg.configKey}`);
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  await ensureDatabase(url);

  console.log('[seed] Starting...');
  await seedRoles();
  await seedAdminUser();
  const demoUserId = await seedDemoUser();
  await seedSampleRoutes(demoUserId);
  await seedSystemConfig();
  console.log('[seed] Done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
