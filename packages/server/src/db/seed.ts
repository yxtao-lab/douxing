import '../config/env.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { ensureDatabase } from './ensure-database.js';
import { getDb } from './client.js';
import { users, roles, userRoles, systemConfig, travelRoutes } from './schema/index.js';
import { seedAttractions, seedMissingAttractionSeeds, syncAttractionsFromRouteDetail } from '../services/attraction.service.js';
import { seedBadges } from '../services/badge.service.js';
import { seedAchievementDefinitions } from '../services/achievement.service.js';
import { seedRoutePlaybooks } from '../services/playbook.service.js';
import { seedWorkflowTemplates } from '../services/workflow-template.service.js';
import { sysDept, sysPost, sysDictType, sysDictData, sysNotice, sysMenu } from '../db/schema/sys-admin.js';
import { DEFAULT_MENU_SEED, seedDefaultRoleMenus, syncMissingMenusFromSeed } from '../services/sys-admin.service.js';
import { seedMarketplaceDemo } from '../services/marketplace/marketplace-seed.service.js';
import { RouteStatus } from '@douxing/shared';
import { RoleCode, UserType, MemberLevel } from '@douxing/shared';
import {
  DEV_DEFAULT_ADMIN_PASSWORD,
  isProductionEnv,
  readAdminInitialPassword,
  readAdminInitialUsername,
  validateAdminPassword,
} from '../utils/admin-password.util.js';

async function seedRoles() {
  const db = getDb();
  const roleList = [
    { code: RoleCode.ADMIN, name: '管理员', description: '系统管理员' },
    { code: RoleCode.OPERATOR, name: '运营', description: '业务与内容运营，无系统用户/角色删改' },
    { code: RoleCode.AUDITOR, name: '审核员', description: '景点审核与内容处理' },
    { code: RoleCode.MERCHANT, name: '商户', description: '发单接单商户与个人服务者' },
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
  const username = readAdminInitialUsername();
  const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (existing.length > 0) {
    console.log(`[seed] Admin user "${username}" already exists, skip`);
    return;
  }

  let password: string;
  const envPassword = readAdminInitialPassword();

  if (isProductionEnv()) {
    if (!envPassword) {
      console.log(
        '[seed] Production: 未设置 ADMIN_INITIAL_PASSWORD，跳过创建管理员（请用 reset-admin-password 或手动设置 env 后重跑 seed）',
      );
      return;
    }
    const validationError = validateAdminPassword(envPassword);
    if (validationError) {
      throw new Error(`[seed] Production: ADMIN_INITIAL_PASSWORD 不符合要求: ${validationError}`);
    }
    password = envPassword;
  } else {
    password = envPassword ?? DEV_DEFAULT_ADMIN_PASSWORD;
    if (!envPassword) {
      console.log('[seed] Development: 使用默认 admin/admin123（仅本地，勿用于生产）');
    }
  }

  const hashed = await bcrypt.hash(password, isProductionEnv() ? 12 : 10);
  const [result] = await db.insert(users).values({
    username,
    passwordHash: hashed,
    nickname: '系统管理员',
    email: 'admin@douxing.com',
    userType: UserType.NORMAL,
    memberLevel: MemberLevel.VIP,
    status: 1,
  });

  const adminRole = await db.select().from(roles).where(eq(roles.code, RoleCode.ADMIN)).limit(1);
  if (adminRole[0] && result.insertId) {
    await db.insert(userRoles).values({
      userId: Number(result.insertId),
      roleId: adminRole[0].id,
    });
  }

  console.log(`[seed] Created admin user (username: ${username})`);
}

async function seedDemoUser(): Promise<number | null> {
  if (isProductionEnv()) {
    console.log('[seed] Production: skip demo user (demo/demo123)');
    return null;
  }

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
    memberLevel: MemberLevel.SILVER,
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

async function seedSampleRoutes(creatorId: number | null) {
  if (creatorId == null) {
    console.log('[seed] No demo creator, skip sample routes');
    return;
  }

  const db = getDb();
  const existing = await db.select().from(travelRoutes).limit(1);
  if (existing.length > 0) {
    console.log('[seed] Sample routes already exist, skip');
    return;
  }

  const sampleDetail = await syncAttractionsFromRouteDetail(
    {
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
    },
    { city: '杭州', interestTags: ['文化', '自然'] },
  );

  await db.insert(travelRoutes).values({
    name: '杭州西湖经典一日游',
    description: '适合周末短途，含西湖核心景点。',
    budgetRange: '500-1000',
    days: 1,
    interestTags: ['文化', '自然'],
    routeDetail: {
      days: sampleDetail.days,
      isAiGenerated: false,
      unlockPrice: 0,
      isUnlocked: true,
    },
    creatorId,
    status: RouteStatus.PUBLISHED,
    isPublic: 1,
    viewCount: 128,
    likeCount: 12,
    collectCount: 5,
  });
  console.log('[seed] Created sample travel route');
}

async function seedSystemConfig() {
  const db = getDb();
  const configs = [
    { configKey: 'app_name', configValue: '兜行', remark: '应用名称' },
    { configKey: 'app_version', configValue: '1.0.0', remark: '应用版本' },
    { configKey: 'maintenance_mode', configValue: 'false', remark: '站点维护模式（true=下线）' },
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

async function seedSystemAdmin() {
  const db = getDb();

  const deptExisting = await db.select().from(sysDept).limit(1);
  if (deptExisting.length === 0) {
    const [rootResult] = await db.insert(sysDept).values({ parentId: 0, name: '兜行科技', sortOrder: 0 });
    const rootId = Number(rootResult.insertId);
    await db.insert(sysDept).values([
      { parentId: rootId, name: '研发部', sortOrder: 1 },
      { parentId: rootId, name: '运营部', sortOrder: 2 },
      { parentId: rootId, name: '产品部', sortOrder: 3 },
    ]);
    console.log('[seed] Created sys_dept');
  }

  const postExisting = await db.select().from(sysPost).limit(1);
  if (postExisting.length === 0) {
    await db.insert(sysPost).values([
      { code: 'ceo', name: '董事长', sortOrder: 1 },
      { code: 'pm', name: '项目经理', sortOrder: 2 },
      { code: 'dev', name: '开发工程师', sortOrder: 3 },
      { code: 'ops', name: '运营专员', sortOrder: 4 },
    ]);
    console.log('[seed] Created sys_post');
  }

  const dictTypeExisting = await db.select().from(sysDictType).limit(1);
  if (dictTypeExisting.length === 0) {
    await db.insert(sysDictType).values([
      { dictType: 'sys_user_sex', dictName: '用户性别', remark: '用户性别列表' },
      { dictType: 'sys_normal_disable', dictName: '系统状态', remark: '正常/停用' },
      { dictType: 'sys_notice_type', dictName: '通知类型', remark: '通知/公告' },
    ]);
    await db.insert(sysDictData).values([
      { dictType: 'sys_user_sex', dictLabel: '男', dictValue: '1', sortOrder: 1 },
      { dictType: 'sys_user_sex', dictLabel: '女', dictValue: '2', sortOrder: 2 },
      { dictType: 'sys_user_sex', dictLabel: '未知', dictValue: '0', sortOrder: 3 },
      { dictType: 'sys_normal_disable', dictLabel: '正常', dictValue: '1', sortOrder: 1 },
      { dictType: 'sys_normal_disable', dictLabel: '停用', dictValue: '0', sortOrder: 2 },
      { dictType: 'sys_notice_type', dictLabel: '通知', dictValue: '1', sortOrder: 1 },
      { dictType: 'sys_notice_type', dictLabel: '公告', dictValue: '2', sortOrder: 2 },
    ]);
    console.log('[seed] Created sys_dict');
  }

  const noticeExisting = await db.select().from(sysNotice).limit(1);
  if (noticeExisting.length === 0) {
    await db.insert(sysNotice).values({
      title: '欢迎使用兜行管理后台',
      noticeType: 2,
      status: 1,
      content: '系统管理、监控与日志模块已上线，可在侧栏「系统管理」「系统监控」「日志管理」中体验。',
    });
    console.log('[seed] Created sys_notice');
  }

  const menuExisting = await db.select().from(sysMenu).limit(1);
  if (menuExisting.length === 0) {
    const idByKey = new Map<string, number>();
    for (const item of DEFAULT_MENU_SEED) {
      const parentId = item.parentKey ? (idByKey.get(item.parentKey) ?? 0) : 0;
      const [result] = await db.insert(sysMenu).values({
        parentId,
        menuKey: item.menuKey,
        menuName: item.menuName,
        menuType: item.menuType,
        path: item.path ?? null,
        component: item.component ?? null,
        perms: item.perms ?? null,
        icon: item.icon ?? null,
        sortOrder: item.sortOrder,
      });
      idByKey.set(item.menuKey, Number(result.insertId));
    }
    console.log('[seed] Created sys_menu');
  } else {
    for (const item of DEFAULT_MENU_SEED) {
      await db
        .update(sysMenu)
        .set({
          ...(item.icon ? { icon: item.icon } : {}),
          sortOrder: item.sortOrder,
        })
        .where(eq(sysMenu.menuKey, item.menuKey));
    }
    console.log('[seed] Synced menu icons and sortOrder from DEFAULT_MENU_SEED');
  }

  await syncMissingMenusFromSeed();

  await seedDefaultRoleMenus();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  await ensureDatabase(url);

  console.log(`[seed] Starting... (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`);
  await seedRoles();
  await seedAdminUser();
  const demoUserId = await seedDemoUser();
  await seedAttractions();
  await seedMissingAttractionSeeds();
  await seedBadges();
  await seedAchievementDefinitions();
  await seedRoutePlaybooks();
  const wfInserted = await seedWorkflowTemplates();
  if (wfInserted > 0) {
    console.log(`[seed] Inserted ${wfInserted} workflow templates`);
  }
  await seedSampleRoutes(demoUserId);
  await seedMarketplaceDemo(demoUserId);
  await seedSystemConfig();
  await seedSystemAdmin();
  console.log('[seed] Done');
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
