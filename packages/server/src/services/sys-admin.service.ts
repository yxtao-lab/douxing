import os from 'node:os';
import { count, desc, eq, inArray, isNull, like, notLike, or, and, gte, lte } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  APP_NAME,
  buildPaginatedResult,
  resolveApiLogMeta,
  getApiModuleUrlLikePatterns,
  getAllKnownApiModuleUrlLikePatterns,
  RoleCode,
  SystemConfigKey,
  UserStatus,
  type PaginatedResult,
  type UserInfo,
} from '@douxing/shared';
import { getDb } from '../db/client.js';
import { users, roles, userRoles, systemConfig } from '../db/schema/index.js';
import {
  invalidateSiteStatusCache,
  syncPcSiteOfflineFlag,
} from './site-status.service.js';
import { getAccessibleMenuIdsForUser } from './permission.service.js';
import { formatDbDateTimeForApi } from '../utils/api-datetime.js';
import {
  sysDept,
  sysPost,
  sysDictType,
  sysDictData,
  sysNotice,
  sysOperLog,
  sysLoginLog,
  sysApiLog,
  sysMenu,
  roleMenu,
} from '../db/schema/sys-admin.js';
import { getUserWithRoles } from './user.service.js';
import { getAnalyticsOverview } from './analytics.service.js';
import { getRedisClient } from './redis-client.service.js';
import { isRedisEnabled } from '../config/redis.js';
import { listOnlineSessions } from './online-session.service.js';

export interface AdminUserRow extends UserInfo {
  createdAt: string;
}

export interface RoleRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  userCount: number;
}

export interface DeptRow {
  id: number;
  parentId: number;
  name: string;
  sortOrder: number;
  status: number;
  createdAt: string;
}

export interface PostRow {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  status: number;
  remark: string | null;
  createdAt: string;
}

export interface DictTypeRow {
  id: number;
  dictType: string;
  dictName: string;
  status: number;
  remark: string | null;
  createdAt: string;
}

export interface DictDataRow {
  id: number;
  dictType: string;
  dictLabel: string;
  dictValue: string;
  sortOrder: number;
  status: number;
  remark: string | null;
  createdAt: string;
}

export interface NoticeRow {
  id: number;
  title: string;
  noticeType: number;
  status: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigRow {
  id: number;
  configKey: string;
  configValue: string;
  remark: string | null;
  updatedAt: string;
}

export interface OperLogRow {
  id: number;
  title: string;
  operName: string;
  operUrl: string;
  method: string;
  operIp: string | null;
  status: number;
  errorMsg: string | null;
  operTime: string;
}

export interface LoginLogRow {
  id: number;
  username: string;
  ip: string | null;
  browser: string | null;
  os: string | null;
  status: number;
  msg: string | null;
  loginTime: string;
}

export interface ApiLogRow {
  id: number;
  traceId: string | null;
  operName: string;
  requestUrl: string;
  method: string;
  apiModuleKey: string;
  apiDescKey: string;
  requestParams: string | null;
  responseBody: string | null;
  statusCode: number;
  operIp: string | null;
  costTime: number;
  status: number;
  errorMsg: string | null;
  requestTime: string;
}

export interface MenuRow {
  id: number;
  parentId: number;
  menuKey: string;
  menuName: string;
  menuType: number;
  path: string | null;
  component: string | null;
  perms: string | null;
  icon: string | null;
  sortOrder: number;
  isFrame: number;
  visible: number;
  status: number;
  routeParams: string | null;
  remark: string | null;
  children?: MenuRow[];
}

export interface MenuTreeNode {
  key: string;
  title: string;
  path?: string;
  icon?: string;
  children?: MenuTreeNode[];
}

/** S2 · 侧栏导航节点（按用户 role_menu 过滤） */
export interface NavMenuNode {
  menuKey: string;
  menuName: string;
  path?: string;
  icon?: string;
  children?: NavMenuNode[];
}

export const MenuType = {
  DIRECTORY: 1,
  MENU: 2,
  BUTTON: 3,
} as const;

const SCHEDULED_JOBS = [
  { id: 'analytics-rollup', name: '指标日汇总', cron: '0 2 * * *', status: 'active', remark: 'DT2 跑批任务（进程内定时 + pnpm analytics:rollup）' },
  { id: 'cache-cleanup', name: '缓存清理', cron: '0 3 * * 0', status: 'pending', remark: 'Redis 过期键扫描' },
  { id: 'log-archive', name: '日志归档', cron: '0 4 1 * *', status: 'pending', remark: '操作/登录/接口日志归档' },
];

function mapMenuRow(row: typeof sysMenu.$inferSelect): MenuRow {
  return {
    id: row.id,
    parentId: row.parentId,
    menuKey: row.menuKey,
    menuName: row.menuName,
    menuType: row.menuType,
    path: row.path,
    component: row.component,
    perms: row.perms,
    icon: row.icon,
    sortOrder: row.sortOrder,
    isFrame: row.isFrame,
    visible: row.visible,
    status: row.status,
    routeParams: row.routeParams,
    remark: row.remark,
  };
}

function buildMenuTree(rows: MenuRow[], parentId = 0): MenuRow[] {
  return rows
    .filter((row) => row.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((row) => {
      const children = buildMenuTree(rows, row.id);
      const node: MenuRow = { ...row };
      if (children.length > 0) node.children = children;
      return node;
    });
}

function filterMenuTree(nodes: MenuRow[], keyword?: string): MenuRow[] {
  const kw = keyword?.trim().toLowerCase();
  if (!kw) return nodes;
  return nodes.reduce<MenuRow[]>((acc, node) => {
    const children = node.children ? filterMenuTree(node.children, kw) : [];
    const selfMatch =
      node.menuName.toLowerCase().includes(kw) ||
      node.menuKey.toLowerCase().includes(kw) ||
      (node.path?.toLowerCase().includes(kw) ?? false) ||
      (node.perms?.toLowerCase().includes(kw) ?? false);
    if (selfMatch || children.length > 0) {
      acc.push({ ...node, children: children.length > 0 ? children : undefined });
    }
    return acc;
  }, []);
}

async function collectDescendantIds(rootId: number): Promise<Set<number>> {
  const db = getDb();
  const rows = await db.select({ id: sysMenu.id, parentId: sysMenu.parentId }).from(sysMenu);
  const descendants = new Set<number>();
  function walk(parentId: number) {
    for (const row of rows) {
      if (row.parentId === parentId && !descendants.has(row.id)) {
        descendants.add(row.id);
        walk(row.id);
      }
    }
  }
  walk(rootId);
  return descendants;
}

export async function listMenusTree(keyword?: string): Promise<MenuRow[]> {
  const db = getDb();
  const rows = await db.select().from(sysMenu).orderBy(sysMenu.sortOrder, sysMenu.id);
  const tree = buildMenuTree(rows.map(mapMenuRow));
  return filterMenuTree(tree, keyword);
}

export async function getMenuById(id: number): Promise<MenuRow | null> {
  const db = getDb();
  const [row] = await db.select().from(sysMenu).where(eq(sysMenu.id, id)).limit(1);
  return row ? mapMenuRow(row) : null;
}

export async function createMenu(input: {
  parentId: number;
  menuKey: string;
  menuName: string;
  menuType?: number;
  path?: string | null;
  component?: string | null;
  perms?: string | null;
  icon?: string | null;
  sortOrder?: number;
  isFrame?: number;
  visible?: number;
  status?: number;
  routeParams?: string | null;
  remark?: string | null;
}) {
  const db = getDb();
  const [result] = await db.insert(sysMenu).values({
    parentId: input.parentId,
    menuKey: input.menuKey,
    menuName: input.menuName,
    menuType: input.menuType ?? MenuType.MENU,
    path: input.path ?? null,
    component: input.component ?? null,
    perms: input.perms ?? null,
    icon: input.icon ?? null,
    sortOrder: input.sortOrder ?? 0,
    isFrame: input.isFrame ?? 0,
    visible: input.visible ?? 1,
    status: input.status ?? 1,
    routeParams: input.routeParams ?? null,
    remark: input.remark ?? null,
  });
  return Number(result.insertId);
}

export async function updateMenu(
  id: number,
  input: {
    parentId?: number;
    menuName?: string;
    menuType?: number;
    path?: string | null;
    component?: string | null;
    perms?: string | null;
    icon?: string | null;
    sortOrder?: number;
    isFrame?: number;
    visible?: number;
    status?: number;
    routeParams?: string | null;
    remark?: string | null;
  },
) {
  if (input.parentId !== undefined) {
    if (input.parentId === id) return { error: '上级菜单不能为自身' };
    const descendants = await collectDescendantIds(id);
    if (descendants.has(input.parentId)) return { error: '上级菜单不能为当前菜单的子菜单' };
  }
  const db = getDb();
  const patch: Partial<typeof sysMenu.$inferInsert> = {};
  if (input.parentId !== undefined) patch.parentId = input.parentId;
  if (input.menuName !== undefined) patch.menuName = input.menuName;
  if (input.menuType !== undefined) patch.menuType = input.menuType;
  if (input.path !== undefined) patch.path = input.path;
  if (input.component !== undefined) patch.component = input.component;
  if (input.perms !== undefined) patch.perms = input.perms;
  if (input.icon !== undefined) patch.icon = input.icon;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  if (input.isFrame !== undefined) patch.isFrame = input.isFrame;
  if (input.visible !== undefined) patch.visible = input.visible;
  if (input.status !== undefined) patch.status = input.status;
  if (input.routeParams !== undefined) patch.routeParams = input.routeParams;
  if (input.remark !== undefined) patch.remark = input.remark;
  if (Object.keys(patch).length === 0) return { ok: true };
  await db.update(sysMenu).set(patch).where(eq(sysMenu.id, id));
  return { ok: true };
}

export async function deleteMenu(id: number) {
  const db = getDb();
  const children = await db.select().from(sysMenu).where(eq(sysMenu.parentId, id)).limit(1);
  if (children.length > 0) return { error: '存在子菜单，无法删除' };
  await db.delete(sysMenu).where(eq(sysMenu.id, id));
  return { ok: true };
}

export async function getMenuTree(): Promise<MenuTreeNode[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(sysMenu)
    .where(and(eq(sysMenu.visible, 1), eq(sysMenu.status, 1)))
    .orderBy(sysMenu.sortOrder, sysMenu.id);
  const navRows = rows.filter((row) => row.menuType !== MenuType.BUTTON);

  function toNavTree(parentId = 0): MenuTreeNode[] {
    return navRows
      .filter((row) => row.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((row) => {
        const children = toNavTree(row.id);
        const node: MenuTreeNode = {
          key: row.menuKey,
          title: row.menuName,
        };
        if (row.path) node.path = row.path;
        if (row.icon) node.icon = row.icon;
        if (children.length > 0) node.children = children;
        return node;
      });
  }

  return toNavTree();
}

/** S2 · 当前用户可访问的侧栏菜单树（目录 + 菜单，不含按钮） */
export async function getNavMenuTreeForUser(userId: number): Promise<NavMenuNode[]> {
  const accessibleIds = await getAccessibleMenuIdsForUser(userId);
  if (accessibleIds.size === 0) return [];

  const db = getDb();
  const rows = await db
    .select()
    .from(sysMenu)
    .where(and(eq(sysMenu.visible, 1), eq(sysMenu.status, 1)))
    .orderBy(sysMenu.sortOrder, sysMenu.id);
  const navRows = rows.filter(
    (row) => row.menuType !== MenuType.BUTTON && accessibleIds.has(row.id),
  );

  function toUserNavTree(parentId = 0): NavMenuNode[] {
    return navRows
      .filter((row) => row.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
      .map((row) => {
        const children = toUserNavTree(row.id);
        const node: NavMenuNode = {
          menuKey: row.menuKey,
          menuName: row.menuName,
        };
        if (row.path) node.path = row.path;
        if (row.icon) node.icon = row.icon;
        if (children.length > 0) node.children = children;
        return node;
      });
  }

  return toUserNavTree();
}

export interface MenuSeedItem {
  menuKey: string;
  menuName: string;
  parentKey?: string;
  menuType: number;
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder: number;
}

export const DEFAULT_MENU_SEED: MenuSeedItem[] = [
  { menuKey: 'home', menuName: '工作台', menuType: MenuType.MENU, path: '/', icon: 'HomeOutlined', sortOrder: 1 },
  { menuKey: 'data', menuName: '数据中台', menuType: MenuType.DIRECTORY, icon: 'BarChartOutlined', sortOrder: 2 },
  { menuKey: 'analytics', menuName: '数据分析', parentKey: 'data', menuType: MenuType.MENU, path: '/analytics', perms: 'data:analytics:view', icon: 'BarChartOutlined', sortOrder: 3 },
  { menuKey: 'plan-diagnostics', menuName: '规划诊断', parentKey: 'data', menuType: MenuType.MENU, path: '/plan-sessions/diagnostics', perms: 'data:analytics:view', icon: 'NodeIndexOutlined', sortOrder: 4 },
  { menuKey: 'workflow-templates', menuName: '工作流模板', parentKey: 'data', menuType: MenuType.MENU, path: '/workflow-templates', perms: 'data:analytics:view', icon: 'ApartmentOutlined', sortOrder: 5 },
  { menuKey: 'biz', menuName: '业务管理', menuType: MenuType.DIRECTORY, icon: 'UnorderedListOutlined', sortOrder: 10 },
  { menuKey: 'routes', menuName: '路线', parentKey: 'biz', menuType: MenuType.MENU, path: '/routes', perms: 'biz:routes:list', icon: 'UnorderedListOutlined', sortOrder: 11 },
  { menuKey: 'orders', menuName: '订单', parentKey: 'biz', menuType: MenuType.MENU, path: '/orders', perms: 'biz:orders:list', icon: 'ShoppingOutlined', sortOrder: 12 },
  { menuKey: 'membership', menuName: '会员', parentKey: 'biz', menuType: MenuType.DIRECTORY, icon: 'CrownOutlined', sortOrder: 13 },
  { menuKey: 'membership-users', menuName: '会员管理', parentKey: 'membership', menuType: MenuType.MENU, path: '/membership/users', perms: 'biz:membership:users', icon: 'CrownOutlined', sortOrder: 131 },
  { menuKey: 'membership-logs', menuName: '会员日志', parentKey: 'membership', menuType: MenuType.MENU, path: '/membership/logs', perms: 'biz:membership:logs', icon: 'HistoryOutlined', sortOrder: 132 },
  { menuKey: 'membership-products', menuName: '会员套餐', parentKey: 'membership', menuType: MenuType.MENU, path: '/membership/products', perms: 'biz:membership:products', icon: 'GiftOutlined', sortOrder: 133 },
  { menuKey: 'checkins', menuName: '打卡', parentKey: 'biz', menuType: MenuType.MENU, path: '/checkins', perms: 'biz:checkins:list', icon: 'EnvironmentOutlined', sortOrder: 14 },
  { menuKey: 'checkins-map', menuName: '打卡地图', parentKey: 'biz', menuType: MenuType.MENU, path: '/checkins/map', perms: 'biz:checkins:map', icon: 'GlobalOutlined', sortOrder: 15 },
  { menuKey: 'content', menuName: '内容运营', menuType: MenuType.DIRECTORY, icon: 'AuditOutlined', sortOrder: 20 },
  { menuKey: 'attractions-pending', menuName: '景点审核', parentKey: 'content', menuType: MenuType.MENU, path: '/attractions/pending', perms: 'content:attractions:pending', icon: 'AuditOutlined', sortOrder: 21 },
  { menuKey: 'route-media-pending', menuName: '路线视频审核', parentKey: 'content', menuType: MenuType.MENU, path: '/attractions/media/pending', perms: 'content:attractions:pending', icon: 'VideoCameraOutlined', sortOrder: 22 },
  { menuKey: 'attractions-manage', menuName: '景点封面', parentKey: 'content', menuType: MenuType.MENU, path: '/attractions/manage', perms: 'content:attractions:manage', icon: 'PictureOutlined', sortOrder: 23 },
  { menuKey: 'playbooks', menuName: '玩法动线', parentKey: 'content', menuType: MenuType.MENU, path: '/playbooks/manage', perms: 'content:playbooks:list', icon: 'BookOutlined', sortOrder: 24 },
  { menuKey: 'marketplace', menuName: '发单接单', menuType: MenuType.DIRECTORY, icon: 'ShopOutlined', sortOrder: 25 },
  { menuKey: 'marketplace-orgs', menuName: '商户管理', parentKey: 'marketplace', menuType: MenuType.MENU, path: '/marketplace/orgs', perms: 'marketplace:org:list', icon: 'TeamOutlined', sortOrder: 251 },
  { menuKey: 'marketplace-orgs-pending', menuName: '入驻审核', parentKey: 'marketplace', menuType: MenuType.MENU, path: '/marketplace/orgs/pending', perms: 'marketplace:org:audit', icon: 'AuditOutlined', sortOrder: 252 },
  { menuKey: 'marketplace-demands', menuName: '需求单', parentKey: 'marketplace', menuType: MenuType.MENU, path: '/marketplace/demands', perms: 'marketplace:demand:list', icon: 'FileSearchOutlined', sortOrder: 253 },
  { menuKey: 'partner-workbench', menuName: '商户工作台', menuType: MenuType.DIRECTORY, icon: 'ShopOutlined', sortOrder: 26 },
  { menuKey: 'partner-home', menuName: '商户首页', parentKey: 'partner-workbench', menuType: MenuType.MENU, path: '/partner', perms: 'marketplace:partner:home', icon: 'HomeOutlined', sortOrder: 261 },
  { menuKey: 'partner-onboard', menuName: '入驻认证', parentKey: 'partner-workbench', menuType: MenuType.MENU, path: '/partner/onboard', perms: 'marketplace:partner:onboard', icon: 'AuditOutlined', sortOrder: 262 },
  { menuKey: 'partner-demands', menuName: '接单大厅', parentKey: 'partner-workbench', menuType: MenuType.MENU, path: '/partner/demands', perms: 'marketplace:partner:demands', icon: 'FileSearchOutlined', sortOrder: 263 },
  { menuKey: 'partner-quotes', menuName: '我的报价', parentKey: 'partner-workbench', menuType: MenuType.MENU, path: '/partner/quotes', perms: 'marketplace:partner:quotes', icon: 'TagOutlined', sortOrder: 264 },
  { menuKey: 'partner-orders', menuName: '我的订单', parentKey: 'partner-workbench', menuType: MenuType.MENU, path: '/partner/orders', perms: 'marketplace:partner:orders', icon: 'ShoppingOutlined', sortOrder: 265 },
  { menuKey: 'system', menuName: '系统管理', menuType: MenuType.DIRECTORY, path: 'system', icon: 'SettingOutlined', sortOrder: 40 },
  { menuKey: 'sys-users', menuName: '用户管理', parentKey: 'system', menuType: MenuType.MENU, path: '/system/users', perms: 'system:user:list', icon: 'UserOutlined', sortOrder: 41 },
  { menuKey: 'sys-roles', menuName: '角色管理', parentKey: 'system', menuType: MenuType.MENU, path: '/system/roles', perms: 'system:role:list', icon: 'TeamOutlined', sortOrder: 42 },
  { menuKey: 'sys-menus', menuName: '菜单管理', parentKey: 'system', menuType: MenuType.MENU, path: '/system/menus', perms: 'system:menu:list', icon: 'MenuOutlined', sortOrder: 43 },
  { menuKey: 'sys-depts', menuName: '部门管理', parentKey: 'system', menuType: MenuType.MENU, path: '/system/depts', perms: 'system:dept:list', icon: 'ApartmentOutlined', sortOrder: 44 },
  { menuKey: 'sys-posts', menuName: '岗位管理', parentKey: 'system', menuType: MenuType.MENU, path: '/system/posts', perms: 'system:post:list', icon: 'IdcardOutlined', sortOrder: 45 },
  { menuKey: 'sys-dict', menuName: '字典管理', parentKey: 'system', menuType: MenuType.MENU, path: '/system/dict', perms: 'system:dict:list', icon: 'ReadOutlined', sortOrder: 46 },
  { menuKey: 'sys-config', menuName: '参数设置', parentKey: 'system', menuType: MenuType.MENU, path: '/system/config', perms: 'system:config:list', icon: 'FormOutlined', sortOrder: 47 },
  { menuKey: 'sys-notices', menuName: '通知公告', parentKey: 'system', menuType: MenuType.MENU, path: '/system/notices', perms: 'system:notice:list', icon: 'NotificationOutlined', sortOrder: 48 },
  { menuKey: 'monitor', menuName: '系统监控', menuType: MenuType.DIRECTORY, path: 'monitor', icon: 'RadarChartOutlined', sortOrder: 50 },
  { menuKey: 'online', menuName: '在线用户', parentKey: 'monitor', menuType: MenuType.MENU, path: '/monitor/online', perms: 'monitor:online:list', icon: 'WifiOutlined', sortOrder: 51 },
  { menuKey: 'jobs', menuName: '定时任务', parentKey: 'monitor', menuType: MenuType.MENU, path: '/monitor/jobs', perms: 'monitor:job:list', icon: 'ClockCircleOutlined', sortOrder: 52 },
  { menuKey: 'data-monitor', menuName: '数据监控', parentKey: 'monitor', menuType: MenuType.MENU, path: '/monitor/data', perms: 'monitor:data:view', icon: 'RadarChartOutlined', sortOrder: 53 },
  { menuKey: 'server', menuName: '服务监控', parentKey: 'monitor', menuType: MenuType.MENU, path: '/monitor/server', perms: 'monitor:server:view', icon: 'DesktopOutlined', sortOrder: 54 },
  { menuKey: 'cache', menuName: '缓存监控', parentKey: 'monitor', menuType: MenuType.MENU, path: '/monitor/cache', perms: 'monitor:cache:view', icon: 'CloudServerOutlined', sortOrder: 55 },
  { menuKey: 'cache-list', menuName: '缓存列表', parentKey: 'monitor', menuType: MenuType.MENU, path: '/monitor/cache-list', perms: 'monitor:cache:list', icon: 'DatabaseOutlined', sortOrder: 56 },
  { menuKey: 'log', menuName: '日志管理', menuType: MenuType.DIRECTORY, path: 'log', icon: 'FileTextOutlined', sortOrder: 60 },
  { menuKey: 'oper-log', menuName: '操作日志', parentKey: 'log', menuType: MenuType.MENU, path: '/log/oper', perms: 'log:oper:list', icon: 'FileTextOutlined', sortOrder: 61 },
  { menuKey: 'login-log', menuName: '登录日志', parentKey: 'log', menuType: MenuType.MENU, path: '/log/login', perms: 'log:login:list', icon: 'BlockOutlined', sortOrder: 62 },
  { menuKey: 'api-log', menuName: '接口日志', parentKey: 'log', menuType: MenuType.MENU, path: '/log/api', perms: 'log:api:list', icon: 'ApiOutlined', sortOrder: 63 },
  { menuKey: 'ai-service-log', menuName: 'AI 服务日志', parentKey: 'log', menuType: MenuType.MENU, path: '/log/ai-service', perms: 'log:ai-service:list', icon: 'RobotOutlined', sortOrder: 64 },
];

/** S1 · 预置角色默认菜单（menuKey）；admin 使用全部菜单 */
export const DEFAULT_ROLE_MENU_KEYS: Record<string, string[] | 'ALL'> = {
  [RoleCode.ADMIN]: 'ALL',
  [RoleCode.OPERATOR]: [
    'home',
    'data',
    'analytics',
    'plan-diagnostics',
    'workflow-templates',
    'biz',
    'routes',
    'orders',
    'membership',
    'membership-users',
    'membership-logs',
    'membership-products',
    'checkins',
    'checkins-map',
    'content',
    'attractions-manage',
    'playbooks',
    'marketplace',
    'marketplace-demands',
    'log',
    'oper-log',
    'login-log',
    'api-log',
    'ai-service-log',
  ],
  [RoleCode.AUDITOR]: ['home', 'biz', 'orders', 'content', 'attractions-pending', 'route-media-pending', 'playbooks', 'marketplace', 'marketplace-orgs-pending'],
  [RoleCode.MERCHANT]: [
    'partner-workbench',
    'partner-home',
    'partner-onboard',
    'partner-demands',
    'partner-quotes',
    'partner-orders',
  ],
};

export async function listAdminUsersPaginated(
  page: number,
  pageSize: number,
  keyword?: string,
): Promise<PaginatedResult<AdminUserRow>> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const where = keyword
    ? or(
        like(users.username, `%${keyword}%`),
        like(users.nickname, `%${keyword}%`),
        like(users.phone, `%${keyword}%`),
      )
    : undefined;

  const [totalRow] = await db.select({ total: count() }).from(users).where(where);
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(desc(users.id))
    .limit(pageSize)
    .offset(offset);

  const items: AdminUserRow[] = [];
  for (const row of rows) {
    const info = await getUserWithRoles(row.id);
    if (!info) continue;
    items.push({ ...info, createdAt: String(row.createdAt) });
  }

  return buildPaginatedResult(items, Number(totalRow?.total ?? 0), page, pageSize);
}

export async function updateAdminUserStatus(userId: number, status: number) {
  const db = getDb();
  await db.update(users).set({ status }).where(eq(users.id, userId));
  return getUserWithRoles(userId);
}

export async function updateAdminUserRoles(userId: number, roleCodes: string[]) {
  const db = getDb();
  const roleRows = await db.select().from(roles);
  const roleIdByCode = new Map(roleRows.map((r) => [r.code, r.id]));
  const targetIds = roleCodes
    .map((code) => roleIdByCode.get(code))
    .filter((id): id is number => id != null);

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  if (targetIds.length > 0) {
    await db.insert(userRoles).values(targetIds.map((roleId) => ({ userId, roleId })));
  }
  return getUserWithRoles(userId);
}

export async function resetAdminUserPassword(userId: number, password: string) {
  const db = getDb();
  const hashed = await bcrypt.hash(password, 10);
  await db.update(users).set({ passwordHash: hashed }).where(eq(users.id, userId));
}

export async function listRolesWithStats(filter?: { keyword?: string }): Promise<RoleRow[]> {
  const db = getDb();
  const keyword = filter?.keyword?.trim();
  const roleRows = keyword
    ? await db
        .select()
        .from(roles)
        .where(
          or(
            like(roles.code, `%${keyword}%`),
            like(roles.name, `%${keyword}%`),
            like(roles.description, `%${keyword}%`),
          )!,
        )
        .orderBy(roles.id)
    : await db.select().from(roles).orderBy(roles.id);
  const result: RoleRow[] = [];
  for (const role of roleRows) {
    const [cnt] = await db
      .select({ total: count() })
      .from(userRoles)
      .where(eq(userRoles.roleId, role.id));
    result.push({
      id: role.id,
      code: role.code,
      name: role.name,
      description: role.description,
      userCount: Number(cnt?.total ?? 0),
    });
  }
  return result;
}

export async function createRole(input: { code: string; name: string; description?: string }) {
  const db = getDb();
  const [result] = await db.insert(roles).values({
    code: input.code,
    name: input.name,
    description: input.description ?? null,
  });
  return Number(result.insertId);
}

export async function updateRole(
  id: number,
  input: { name?: string; description?: string },
) {
  const db = getDb();
  const patch: Partial<typeof roles.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (Object.keys(patch).length === 0) return;
  await db.update(roles).set(patch).where(eq(roles.id, id));
}

export async function deleteRole(id: number) {
  const db = getDb();
  const roleRow = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  const role = roleRow[0];
  if (!role) return { error: '角色不存在' };
  if (role.code === RoleCode.ADMIN || role.code === RoleCode.USER || role.code === RoleCode.MERCHANT) {
    return { error: '系统内置角色不可删除' };
  }
  const [cnt] = await db
    .select({ total: count() })
    .from(userRoles)
    .where(eq(userRoles.roleId, id));
  if (Number(cnt?.total ?? 0) > 0) {
    return { error: '该角色下仍有用户，无法删除' };
  }
  await db.delete(roles).where(eq(roles.id, id));
  return { ok: true };
}

export async function getRoleMenuIds(roleId: number): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ menuId: roleMenu.menuId })
    .from(roleMenu)
    .where(eq(roleMenu.roleId, roleId));
  return rows.map((row) => row.menuId);
}

export async function updateRoleMenus(roleId: number, menuIds: number[]) {
  const db = getDb();
  const roleRow = await db.select().from(roles).where(eq(roles.id, roleId)).limit(1);
  if (!roleRow[0]) throw new Error('角色不存在');
  if (roleRow[0].code === RoleCode.ADMIN) {
    throw new Error('超级管理员拥有全部菜单，不可修改');
  }

  const uniqueIds = [...new Set(menuIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length > 0) {
    const existing = await db
      .select({ id: sysMenu.id })
      .from(sysMenu)
      .where(inArray(sysMenu.id, uniqueIds));
    const validIds = new Set(existing.map((row) => row.id));
    for (const id of uniqueIds) {
      if (!validIds.has(id)) throw new Error(`菜单 id=${id} 不存在`);
    }
  }

  await db.delete(roleMenu).where(eq(roleMenu.roleId, roleId));
  if (uniqueIds.length > 0) {
    await db.insert(roleMenu).values(uniqueIds.map((menuId) => ({ roleId, menuId })));
  }
}

export async function seedDefaultRoleMenus() {
  const db = getDb();
  const menuRows = await db.select({ id: sysMenu.id, menuKey: sysMenu.menuKey }).from(sysMenu);
  const idByKey = new Map(menuRows.map((row) => [row.menuKey, row.id]));
  const roleRows = await db.select().from(roles);
  const roleIdByCode = new Map(roleRows.map((row) => [row.code, row.id]));

  for (const [roleCode, menuKeys] of Object.entries(DEFAULT_ROLE_MENU_KEYS)) {
    const roleId = roleIdByCode.get(roleCode);
    if (!roleId) continue;

    const existing = await db
      .select({ menuId: roleMenu.menuId })
      .from(roleMenu)
      .where(eq(roleMenu.roleId, roleId))
      .limit(1);
    if (existing.length > 0) continue;

    const targetIds =
      menuKeys === 'ALL'
        ? menuRows.map((row) => row.id)
        : menuKeys
            .map((key) => idByKey.get(key))
            .filter((id): id is number => id != null);

    if (targetIds.length === 0) continue;
    await db.insert(roleMenu).values(targetIds.map((menuId) => ({ roleId, menuId })));
    console.log(`[seed] role_menu: ${roleCode} ← ${targetIds.length} menus`);
  }
}

/** 将 DEFAULT_MENU_SEED 中缺失的菜单写入库，并授予管理员/预置角色 */
export async function syncMissingMenusFromSeed() {
  const { ensureMerchantRoleSeed } = await import('./marketplace/marketplace-merchant-role.service.js');
  await ensureMerchantRoleSeed();
  const db = getDb();
  const menuRows = await db.select({ id: sysMenu.id, menuKey: sysMenu.menuKey }).from(sysMenu);
  const idByKey = new Map(menuRows.map((row) => [row.menuKey, row.id]));
  const existingKeys = new Set(menuRows.map((row) => row.menuKey));
  const insertedMenuIds: number[] = [];

  for (const item of DEFAULT_MENU_SEED) {
    if (existingKeys.has(item.menuKey)) continue;
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
    const newId = Number(result.insertId);
    idByKey.set(item.menuKey, newId);
    existingKeys.add(item.menuKey);
    insertedMenuIds.push(newId);
    console.log(`[seed] Inserted missing menu: ${item.menuKey}`);
  }

  if (insertedMenuIds.length === 0) {
    await seedDefaultRoleMenus();
    return;
  }

  const adminRole = await db.select().from(roles).where(eq(roles.code, RoleCode.ADMIN)).limit(1);
  if (adminRole[0]) {
    await db
      .insert(roleMenu)
      .values(insertedMenuIds.map((menuId) => ({ roleId: adminRole[0]!.id, menuId })));
  }

  for (const [roleCode, menuKeys] of Object.entries(DEFAULT_ROLE_MENU_KEYS)) {
    if (menuKeys === 'ALL') continue;
    const roleRow = await db.select().from(roles).where(eq(roles.code, roleCode)).limit(1);
    if (!roleRow[0]) continue;
    const roleId = roleRow[0].id;
    for (const menuId of insertedMenuIds) {
      const menuKey = [...idByKey.entries()].find(([, id]) => id === menuId)?.[0];
      if (!menuKey || !menuKeys.includes(menuKey)) continue;
      const assigned = await db
        .select({ menuId: roleMenu.menuId })
        .from(roleMenu)
        .where(and(eq(roleMenu.roleId, roleId), eq(roleMenu.menuId, menuId)))
        .limit(1);
      if (assigned.length === 0) {
        await db.insert(roleMenu).values({ roleId, menuId });
      }
    }
  }

  await seedDefaultRoleMenus();
}

export async function listDepts(filter?: {
  keyword?: string;
  status?: number;
  parentId?: number;
}): Promise<DeptRow[]> {
  const db = getDb();
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    conditions.push(like(sysDept.name, `%${keyword}%`));
  }
  if (filter?.status != null) {
    conditions.push(eq(sysDept.status, filter.status));
  }
  if (filter?.parentId != null) {
    conditions.push(eq(sysDept.parentId, filter.parentId));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select()
    .from(sysDept)
    .where(where)
    .orderBy(sysDept.sortOrder, sysDept.id);
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parentId,
    name: r.name,
    sortOrder: r.sortOrder,
    status: r.status,
    createdAt: String(r.createdAt),
  }));
}

export async function createDept(input: {
  parentId: number;
  name: string;
  sortOrder?: number;
  status?: number;
}) {
  const db = getDb();
  const [result] = await db.insert(sysDept).values({
    parentId: input.parentId,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 1,
  });
  return Number(result.insertId);
}

export async function updateDept(
  id: number,
  input: { parentId?: number; name?: string; sortOrder?: number; status?: number },
) {
  const db = getDb();
  await db.update(sysDept).set(input).where(eq(sysDept.id, id));
}

export async function deleteDept(id: number) {
  const db = getDb();
  const children = await db.select().from(sysDept).where(eq(sysDept.parentId, id)).limit(1);
  if (children.length > 0) return { error: '存在子部门，无法删除' };
  await db.delete(sysDept).where(eq(sysDept.id, id));
  return { ok: true };
}

export async function listPostsPaginated(
  page: number,
  pageSize: number,
  filter?: { keyword?: string; status?: number },
): Promise<PaginatedResult<PostRow>> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(
      or(like(sysPost.code, pattern), like(sysPost.name, pattern), like(sysPost.remark, pattern))!,
    );
  }
  if (filter?.status != null) {
    conditions.push(eq(sysPost.status, filter.status));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ total: count() }).from(sysPost).where(where);
  const rows = await db
    .select()
    .from(sysPost)
    .where(where)
    .orderBy(sysPost.sortOrder, desc(sysPost.id))
    .limit(pageSize)
    .offset(offset);
  const items = rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    sortOrder: r.sortOrder,
    status: r.status,
    remark: r.remark,
    createdAt: String(r.createdAt),
  }));
  return buildPaginatedResult(items, Number(totalRow?.total ?? 0), page, pageSize);
}

export async function createPost(input: {
  code: string;
  name: string;
  sortOrder?: number;
  status?: number;
  remark?: string;
}) {
  const db = getDb();
  const [result] = await db.insert(sysPost).values({
    code: input.code,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 1,
    remark: input.remark ?? null,
  });
  return Number(result.insertId);
}

export async function updatePost(
  id: number,
  input: { name?: string; sortOrder?: number; status?: number; remark?: string },
) {
  const db = getDb();
  await db.update(sysPost).set(input).where(eq(sysPost.id, id));
}

export async function deletePost(id: number) {
  const db = getDb();
  await db.delete(sysPost).where(eq(sysPost.id, id));
}

export async function listDictTypes(): Promise<DictTypeRow[]> {
  const db = getDb();
  const rows = await db.select().from(sysDictType).orderBy(desc(sysDictType.id));
  return rows.map((r) => ({
    id: r.id,
    dictType: r.dictType,
    dictName: r.dictName,
    status: r.status,
    remark: r.remark,
    createdAt: String(r.createdAt),
  }));
}

export async function createDictType(input: {
  dictType: string;
  dictName: string;
  status?: number;
  remark?: string;
}) {
  const db = getDb();
  const [result] = await db.insert(sysDictType).values({
    dictType: input.dictType,
    dictName: input.dictName,
    status: input.status ?? 1,
    remark: input.remark ?? null,
  });
  return Number(result.insertId);
}

export async function updateDictType(
  id: number,
  input: { dictName?: string; status?: number; remark?: string },
) {
  const db = getDb();
  await db.update(sysDictType).set(input).where(eq(sysDictType.id, id));
}

export async function deleteDictType(id: number) {
  const db = getDb();
  const row = await db.select().from(sysDictType).where(eq(sysDictType.id, id)).limit(1);
  if (!row[0]) return { error: '字典类型不存在' };
  await db.delete(sysDictData).where(eq(sysDictData.dictType, row[0].dictType));
  await db.delete(sysDictType).where(eq(sysDictType.id, id));
  return { ok: true };
}

export async function listDictData(dictType?: string): Promise<DictDataRow[]> {
  const db = getDb();
  const rows = dictType
    ? await db
        .select()
        .from(sysDictData)
        .where(eq(sysDictData.dictType, dictType))
        .orderBy(sysDictData.sortOrder, sysDictData.id)
    : await db.select().from(sysDictData).orderBy(sysDictData.sortOrder, sysDictData.id);
  return rows.map((r) => ({
    id: r.id,
    dictType: r.dictType,
    dictLabel: r.dictLabel,
    dictValue: r.dictValue,
    sortOrder: r.sortOrder,
    status: r.status,
    remark: r.remark,
    createdAt: String(r.createdAt),
  }));
}

export async function createDictData(input: {
  dictType: string;
  dictLabel: string;
  dictValue: string;
  sortOrder?: number;
  status?: number;
  remark?: string;
}) {
  const db = getDb();
  const [result] = await db.insert(sysDictData).values({
    dictType: input.dictType,
    dictLabel: input.dictLabel,
    dictValue: input.dictValue,
    sortOrder: input.sortOrder ?? 0,
    status: input.status ?? 1,
    remark: input.remark ?? null,
  });
  return Number(result.insertId);
}

export async function updateDictData(
  id: number,
  input: {
    dictLabel?: string;
    dictValue?: string;
    sortOrder?: number;
    status?: number;
    remark?: string;
  },
) {
  const db = getDb();
  await db.update(sysDictData).set(input).where(eq(sysDictData.id, id));
}

export async function deleteDictData(id: number) {
  const db = getDb();
  await db.delete(sysDictData).where(eq(sysDictData.id, id));
}

export async function listNoticesPaginated(
  page: number,
  pageSize: number,
  filter?: {
    keyword?: string;
    noticeType?: number;
    status?: number;
    dateStart?: string;
    dateEnd?: string;
  },
): Promise<PaginatedResult<NoticeRow>> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(or(like(sysNotice.title, pattern), like(sysNotice.content, pattern))!);
  }
  if (filter?.noticeType != null) {
    conditions.push(eq(sysNotice.noticeType, filter.noticeType));
  }
  if (filter?.status != null) {
    conditions.push(eq(sysNotice.status, filter.status));
  }
  if (filter?.dateStart) {
    conditions.push(gte(sysNotice.createdAt, new Date(`${filter.dateStart}T00:00:00`)));
  }
  if (filter?.dateEnd) {
    conditions.push(lte(sysNotice.createdAt, new Date(`${filter.dateEnd}T23:59:59.999`)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [totalRow] = await db.select({ total: count() }).from(sysNotice).where(where);
  const rows = await db
    .select()
    .from(sysNotice)
    .where(where)
    .orderBy(desc(sysNotice.id))
    .limit(pageSize)
    .offset(offset);
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    noticeType: r.noticeType,
    status: r.status,
    content: r.content,
    createdAt: String(r.createdAt),
    updatedAt: String(r.updatedAt),
  }));
  return buildPaginatedResult(items, Number(totalRow?.total ?? 0), page, pageSize);
}

export async function createNotice(input: {
  title: string;
  noticeType?: number;
  status?: number;
  content: string;
}) {
  const db = getDb();
  const [result] = await db.insert(sysNotice).values({
    title: input.title,
    noticeType: input.noticeType ?? 1,
    status: input.status ?? 1,
    content: input.content,
  });
  return Number(result.insertId);
}

export async function updateNotice(
  id: number,
  input: { title?: string; noticeType?: number; status?: number; content?: string },
) {
  const db = getDb();
  await db.update(sysNotice).set(input).where(eq(sysNotice.id, id));
}

export async function deleteNotice(id: number) {
  const db = getDb();
  await db.delete(sysNotice).where(eq(sysNotice.id, id));
}

export async function listConfigs(filter?: { keyword?: string }): Promise<ConfigRow[]> {
  const db = getDb();
  const keyword = filter?.keyword?.trim();
  const rows = keyword
    ? await db
        .select()
        .from(systemConfig)
        .where(
          or(
            like(systemConfig.configKey, `%${keyword}%`),
            like(systemConfig.configValue, `%${keyword}%`),
            like(systemConfig.remark, `%${keyword}%`),
          )!,
        )
        .orderBy(systemConfig.configKey)
    : await db.select().from(systemConfig).orderBy(systemConfig.configKey);
  return rows.map((r) => ({
    id: r.id,
    configKey: r.configKey,
    configValue: r.configValue,
    remark: r.remark,
    updatedAt: String(r.updatedAt),
  }));
}

export async function updateConfig(id: number, configValue: string, remark?: string) {
  const db = getDb();
  const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.id, id)).limit(1);
  const patch: Partial<typeof systemConfig.$inferInsert> = { configValue };
  if (remark !== undefined) patch.remark = remark;
  await db.update(systemConfig).set(patch).where(eq(systemConfig.id, id));
  if (existing?.configKey === SystemConfigKey.MAINTENANCE_MODE) {
    invalidateSiteStatusCache();
    syncPcSiteOfflineFlag(parseMaintenanceConfigValue(configValue));
  }
}

function parseMaintenanceConfigValue(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export interface AdminOperLogListFilter {
  keyword?: string;
  operName?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

export interface AdminLoginLogListFilter {
  keyword?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

function buildOperLogWhere(filter?: AdminOperLogListFilter) {
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(
      or(
        like(sysOperLog.title, pattern),
        like(sysOperLog.operName, pattern),
        like(sysOperLog.operUrl, pattern),
        like(sysOperLog.operIp, pattern),
      )!,
    );
  }
  const operName = filter?.operName?.trim();
  if (operName) {
    conditions.push(like(sysOperLog.operName, `%${operName}%`));
  }
  if (filter?.status != null) {
    conditions.push(eq(sysOperLog.status, filter.status));
  }
  if (filter?.dateStart) {
    conditions.push(gte(sysOperLog.operTime, `${filter.dateStart} 00:00:00`));
  }
  if (filter?.dateEnd) {
    conditions.push(lte(sysOperLog.operTime, `${filter.dateEnd} 23:59:59`));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function buildLoginLogWhere(filter?: AdminLoginLogListFilter) {
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(
      or(
        like(sysLoginLog.username, pattern),
        like(sysLoginLog.ip, pattern),
        like(sysLoginLog.msg, pattern),
      )!,
    );
  }
  if (filter?.status != null) {
    conditions.push(eq(sysLoginLog.status, filter.status));
  }
  if (filter?.dateStart) {
    conditions.push(gte(sysLoginLog.loginTime, `${filter.dateStart} 00:00:00`));
  }
  if (filter?.dateEnd) {
    conditions.push(lte(sysLoginLog.loginTime, `${filter.dateEnd} 23:59:59`));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listOperLogsPaginated(
  page: number,
  pageSize: number,
  filter?: AdminOperLogListFilter,
): Promise<PaginatedResult<OperLogRow>> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const where = buildOperLogWhere(filter);
  const [totalRow] = await db.select({ total: count() }).from(sysOperLog).where(where);
  const rows = await db
    .select()
    .from(sysOperLog)
    .where(where)
    .orderBy(desc(sysOperLog.id))
    .limit(pageSize)
    .offset(offset);
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    operName: r.operName,
    operUrl: r.operUrl,
    method: r.method,
    operIp: r.operIp,
    status: r.status,
    errorMsg: r.errorMsg,
    operTime: formatDbDateTimeForApi(r.operTime),
  }));
  return buildPaginatedResult(items, Number(totalRow?.total ?? 0), page, pageSize);
}

export async function listLoginLogsPaginated(
  page: number,
  pageSize: number,
  filter?: AdminLoginLogListFilter,
): Promise<PaginatedResult<LoginLogRow>> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const where = buildLoginLogWhere(filter);
  const [totalRow] = await db.select({ total: count() }).from(sysLoginLog).where(where);
  const rows = await db
    .select()
    .from(sysLoginLog)
    .where(where)
    .orderBy(desc(sysLoginLog.id))
    .limit(pageSize)
    .offset(offset);
  const items = rows.map((r) => ({
    id: r.id,
    username: r.username,
    ip: r.ip,
    browser: r.browser,
    os: r.os,
    status: r.status,
    msg: r.msg,
    loginTime: formatDbDateTimeForApi(r.loginTime),
  }));
  return buildPaginatedResult(items, Number(totalRow?.total ?? 0), page, pageSize);
}

export interface AdminApiLogListFilter {
  keyword?: string;
  operName?: string;
  method?: string;
  moduleKey?: string;
  status?: number;
  dateStart?: string;
  dateEnd?: string;
}

function buildApiLogWhere(filter?: AdminApiLogListFilter) {
  const conditions = [];
  const keyword = filter?.keyword?.trim();
  if (keyword) {
    const pattern = `%${keyword}%`;
    conditions.push(
      or(
        like(sysApiLog.requestUrl, pattern),
        like(sysApiLog.operIp, pattern),
        like(sysApiLog.errorMsg, pattern),
        like(sysApiLog.apiModule, pattern),
      )!,
    );
  }
  const operName = filter?.operName?.trim();
  if (operName) {
    conditions.push(like(sysApiLog.operName, `%${operName}%`));
  }
  const method = filter?.method?.trim().toUpperCase();
  if (method) {
    conditions.push(eq(sysApiLog.method, method));
  }
  const moduleKey = filter?.moduleKey?.trim();
  if (moduleKey) {
    if (moduleKey === 'other') {
      const knownPatterns = getAllKnownApiModuleUrlLikePatterns();
      const legacyOther =
        knownPatterns.length > 0
          ? and(
              or(isNull(sysApiLog.apiModule), eq(sysApiLog.apiModule, '')),
              ...knownPatterns.map((pattern) => notLike(sysApiLog.requestUrl, pattern)),
            )
          : undefined;
      conditions.push(
        or(eq(sysApiLog.apiModule, 'other'), legacyOther)!,
      );
    } else {
      const patterns = getApiModuleUrlLikePatterns(moduleKey);
      const legacyMatch =
        patterns.length > 0
          ? and(
              or(isNull(sysApiLog.apiModule), eq(sysApiLog.apiModule, '')),
              or(...patterns.map((pattern) => like(sysApiLog.requestUrl, pattern)))!,
            )
          : undefined;
      conditions.push(or(eq(sysApiLog.apiModule, moduleKey), legacyMatch)!);
    }
  }
  if (filter?.status != null) {
    conditions.push(eq(sysApiLog.status, filter.status));
  }
  if (filter?.dateStart) {
    conditions.push(gte(sysApiLog.requestTime, `${filter.dateStart} 00:00:00`));
  }
  if (filter?.dateEnd) {
    conditions.push(lte(sysApiLog.requestTime, `${filter.dateEnd} 23:59:59`));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listApiLogsPaginated(
  page: number,
  pageSize: number,
  filter?: AdminApiLogListFilter,
): Promise<PaginatedResult<ApiLogRow>> {
  const db = getDb();
  const offset = (page - 1) * pageSize;
  const where = buildApiLogWhere(filter);
  const [totalRow] = await db.select({ total: count() }).from(sysApiLog).where(where);
  const rows = await db
    .select()
    .from(sysApiLog)
    .where(where)
    .orderBy(desc(sysApiLog.id))
    .limit(pageSize)
    .offset(offset);
  const items = rows.map((r) => {
    const meta = resolveApiLogMeta(r.method, r.requestUrl);
    return {
      id: r.id,
      traceId: r.traceId,
      operName: r.operName,
      requestUrl: r.requestUrl,
      method: r.method,
      apiModuleKey: r.apiModule ?? meta.moduleKey,
      apiDescKey: meta.descKey,
      requestParams: r.requestParams,
      responseBody: r.responseBody,
      statusCode: r.statusCode,
      operIp: r.operIp,
      costTime: r.costTime,
      status: r.status,
      errorMsg: r.errorMsg,
      requestTime: formatDbDateTimeForApi(r.requestTime),
    };
  });
  return buildPaginatedResult(items, Number(totalRow?.total ?? 0), page, pageSize);
}

export function getOnlineUsers(filter?: { keyword?: string }) {
  return listOnlineSessions(filter);
}

export function getScheduledJobs(filter?: { keyword?: string; status?: string }) {
  const keyword = filter?.keyword?.trim().toLowerCase();
  let jobs = SCHEDULED_JOBS;
  if (keyword) {
    jobs = jobs.filter(
      (job) =>
        job.id.toLowerCase().includes(keyword) ||
        job.name.toLowerCase().includes(keyword) ||
        job.remark.toLowerCase().includes(keyword),
    );
  }
  if (filter?.status) {
    jobs = jobs.filter((job) => job.status === filter.status);
  }
  return jobs;
}

export async function getDataMonitorStats() {
  return getAnalyticsOverview();
}

export async function getServerMonitorInfo() {
  const mem = process.memoryUsage();
  return {
    appName: APP_NAME,
    status: 'ok',
    nodeVersion: process.version,
    platform: process.platform,
    uptime: process.uptime(),
    hostname: os.hostname(),
    cpuCount: os.cpus().length,
    loadAvg: os.loadavg(),
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    timestamp: new Date().toISOString(),
  };
}

export async function getCacheMonitorStats() {
  const enabled = isRedisEnabled();
  const redis = await getRedisClient();
  if (!enabled || !redis) {
    return { enabled: false, connected: false, dbSize: 0, info: null };
  }
  try {
    const dbSize = await redis.dbsize();
    const info = await redis.info('memory');
    return { enabled: true, connected: true, dbSize, info };
  } catch (err) {
    return {
      enabled: true,
      connected: false,
      dbSize: 0,
      info: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function listCacheKeys(pattern = '*', limit = 100) {
  const redis = await getRedisClient();
  if (!redis) return [];
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 50);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0' && keys.length < limit);
  return keys.slice(0, limit);
}

export async function deleteCacheKey(key: string) {
  const redis = await getRedisClient();
  if (!redis) return { error: 'Redis 未启用' };
  await redis.del(key);
  return { ok: true };
}

export async function getLatestNotices(limit = 5) {
  const db = getDb();
  const rows = await db
    .select()
    .from(sysNotice)
    .where(eq(sysNotice.status, 1))
    .orderBy(desc(sysNotice.id))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    noticeType: r.noticeType,
    createdAt: String(r.createdAt),
  }));
}
