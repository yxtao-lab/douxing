/**
 * 接口日志：根据请求方法与路径解析模块与功能描述 i18n 键。
 */

export interface ApiLogMeta {
  moduleKey: string;
  descKey: string;
}

interface ApiLogRouteRule {
  methods?: readonly string[];
  /** 完整路径，如 `/api/auth/me`；动态段用 `:id` */
  path: string;
  moduleKey: string;
  descKey: string;
}

const API_LOG_ROUTE_RULES: readonly ApiLogRouteRule[] = [
  // 认证
  { methods: ['POST'], path: '/api/auth/login', moduleKey: 'auth', descKey: 'auth.login' },
  { methods: ['POST'], path: '/api/auth/register', moduleKey: 'auth', descKey: 'auth.register' },
  { methods: ['POST'], path: '/api/auth/sms/send', moduleKey: 'auth', descKey: 'auth.smsSend' },
  { methods: ['POST'], path: '/api/auth/sms/login', moduleKey: 'auth', descKey: 'auth.smsLogin' },
  { methods: ['POST'], path: '/api/auth/refresh', moduleKey: 'auth', descKey: 'auth.refresh' },
  { methods: ['POST'], path: '/api/auth/logout', moduleKey: 'auth', descKey: 'auth.logout' },
  { methods: ['GET'], path: '/api/auth/me', moduleKey: 'auth', descKey: 'auth.me' },
  // 站点状态
  { methods: ['GET'], path: '/api/status', moduleKey: 'status', descKey: 'status.get' },
  { methods: ['GET'], path: '/api/health', moduleKey: 'health', descKey: 'health.get' },
  // 系统管理
  { methods: ['GET'], path: '/api/system/logs/api', moduleKey: 'system', descKey: 'system.logsApi' },
  { methods: ['GET'], path: '/api/system/logs/ai-service', moduleKey: 'system', descKey: 'system.logsAiService' },
  { methods: ['GET'], path: '/api/system/logs/oper', moduleKey: 'system', descKey: 'system.logsOper' },
  { methods: ['GET'], path: '/api/system/logs/login', moduleKey: 'system', descKey: 'system.logsLogin' },
  { methods: ['GET'], path: '/api/system/menus/tree', moduleKey: 'system', descKey: 'system.menusTree' },
  { methods: ['GET'], path: '/api/system/menus', moduleKey: 'system', descKey: 'system.menusList' },
  { methods: ['GET'], path: '/api/system/site-status', moduleKey: 'system', descKey: 'system.siteStatusGet' },
  { methods: ['PUT'], path: '/api/system/site-status', moduleKey: 'system', descKey: 'system.siteStatusUpdate' },
  { methods: ['GET'], path: '/api/system/users', moduleKey: 'system', descKey: 'system.usersList' },
  { methods: ['GET'], path: '/api/system/roles', moduleKey: 'system', descKey: 'system.rolesList' },
  { methods: ['GET'], path: '/api/system/depts', moduleKey: 'system', descKey: 'system.deptsList' },
  { methods: ['GET'], path: '/api/system/config', moduleKey: 'system', descKey: 'system.configList' },
  { methods: ['GET'], path: '/api/system/notices', moduleKey: 'system', descKey: 'system.noticesList' },
  { methods: ['GET'], path: '/api/system/monitor/online', moduleKey: 'system', descKey: 'system.monitorOnline' },
  { methods: ['GET'], path: '/api/system/monitor/jobs', moduleKey: 'system', descKey: 'system.monitorJobs' },
  // 用户
  { methods: ['GET'], path: '/api/users/me', moduleKey: 'users', descKey: 'users.me' },
  { methods: ['GET'], path: '/api/users/me/membership', moduleKey: 'users', descKey: 'users.membership' },
  { methods: ['GET'], path: '/api/users/me/storage', moduleKey: 'users', descKey: 'users.storage' },
  { methods: ['PUT'], path: '/api/users/me', moduleKey: 'users', descKey: 'users.update' },
  // 路线
  { methods: ['GET'], path: '/api/routes/plaza', moduleKey: 'routes', descKey: 'routes.plaza' },
  { methods: ['GET'], path: '/api/routes/hot', moduleKey: 'routes', descKey: 'routes.hot' },
  { methods: ['GET'], path: '/api/routes', moduleKey: 'routes', descKey: 'routes.list' },
  { methods: ['POST'], path: '/api/routes/generate', moduleKey: 'routes', descKey: 'routes.generate' },
  { methods: ['GET'], path: '/api/routes/:id', moduleKey: 'routes', descKey: 'routes.detail' },
  { methods: ['PUT'], path: '/api/routes/:id', moduleKey: 'routes', descKey: 'routes.update' },
  { methods: ['POST'], path: '/api/routes/:id/publish', moduleKey: 'routes', descKey: 'routes.publish' },
  // 打卡
  { methods: ['GET'], path: '/api/checkins', moduleKey: 'checkins', descKey: 'checkins.list' },
  { methods: ['POST'], path: '/api/checkins', moduleKey: 'checkins', descKey: 'checkins.create' },
  { methods: ['POST'], path: '/api/checkins/photos', moduleKey: 'checkins', descKey: 'checkins.uploadPhoto' },
  // 订单
  { methods: ['GET'], path: '/api/orders', moduleKey: 'orders', descKey: 'orders.list' },
  // 景点
  { methods: ['GET'], path: '/api/attractions/admin/pending', moduleKey: 'attractions', descKey: 'attractions.pending' },
  { methods: ['GET'], path: '/api/attractions/admin', moduleKey: 'attractions', descKey: 'attractions.adminList' },
  // 数据分析
  { methods: ['POST'], path: '/api/analytics/events/batch', moduleKey: 'analytics', descKey: 'analytics.eventsBatch' },
  { methods: ['POST'], path: '/api/analytics/events', moduleKey: 'analytics', descKey: 'analytics.events' },
  { methods: ['GET'], path: '/api/analytics/overview', moduleKey: 'analytics', descKey: 'analytics.overview' },
  { methods: ['GET'], path: '/api/analytics/trends', moduleKey: 'analytics', descKey: 'analytics.trends' },
  // 旅行宠物
  { methods: ['GET'], path: '/api/pets/me/floating-context', moduleKey: 'pets', descKey: 'pets.floatingContext' },
  { methods: ['GET'], path: '/api/pets/me', moduleKey: 'pets', descKey: 'pets.me' },
  { methods: ['PATCH'], path: '/api/pets/me', moduleKey: 'pets', descKey: 'pets.update' },
  { methods: ['GET'], path: '/api/pets/me/memories', moduleKey: 'pets', descKey: 'pets.memoriesList' },
  // 会员
  { methods: ['GET'], path: '/api/membership/products', moduleKey: 'membership', descKey: 'membership.products' },
  { methods: ['GET'], path: '/api/membership/logs', moduleKey: 'membership', descKey: 'membership.logs' },
  // 成就 / 徽章 / 排行榜
  { methods: ['GET'], path: '/api/achievements', moduleKey: 'achievements', descKey: 'achievements.list' },
  { methods: ['GET'], path: '/api/badges', moduleKey: 'badges', descKey: 'badges.list' },
  { methods: ['GET'], path: '/api/leaderboard', moduleKey: 'leaderboard', descKey: 'leaderboard.list' },
  // 玩法 / 相册 / 分享
  { methods: ['GET'], path: '/api/playbooks/admin', moduleKey: 'playbooks', descKey: 'playbooks.adminList' },
  { methods: ['GET'], path: '/api/journey-albums', moduleKey: 'journeyAlbums', descKey: 'journeyAlbums.list' },
  { methods: ['GET'], path: '/api/share/routes/:id', moduleKey: 'share', descKey: 'share.route' },
  // Agent
  { methods: ['GET'], path: '/api/agent/tools', moduleKey: 'agentTools', descKey: 'agentTools.list' },
  { methods: ['POST'], path: '/api/agent/tools/:name', moduleKey: 'agentTools', descKey: 'agentTools.invoke' },
  { methods: ['POST'], path: '/api/agent/route-intent', moduleKey: 'agentRoute', descKey: 'agentRoute.parse' },
  // 语音
  { methods: ['POST'], path: '/api/speech/transcribe', moduleKey: 'speech', descKey: 'speech.transcribe' },
  // 规划会话
  { methods: ['GET'], path: '/api/plan-sessions', moduleKey: 'planSessions', descKey: 'planSessions.list' },
  { methods: ['POST'], path: '/api/plan-sessions', moduleKey: 'planSessions', descKey: 'planSessions.create' },
  { methods: ['GET'], path: '/api/plan-sessions/:id/stream', moduleKey: 'planSessions', descKey: 'planSessions.stream' },
  { methods: ['GET'], path: '/api/admin/plan-sessions/:id/workflow-trace', moduleKey: 'planSessions', descKey: 'planSessions.workflowTrace' },
  { methods: ['GET'], path: '/api/admin/plan-sessions/:id/cost-summary', moduleKey: 'planSessions', descKey: 'planSessions.costSummary' },
  { methods: ['GET'], path: '/api/admin/plan-sessions/recent', moduleKey: 'planSessions', descKey: 'planSessions.adminRecent' },
  { methods: ['POST'], path: '/api/admin/plan-sessions/sandbox-run', moduleKey: 'planSessions', descKey: 'planSessions.sandboxRun' },
];

const MODULE_SEGMENT_MAP: Record<string, string> = {
  auth: 'auth',
  status: 'status',
  health: 'health',
  system: 'system',
  users: 'users',
  routes: 'routes',
  checkins: 'checkins',
  orders: 'orders',
  attractions: 'attractions',
  analytics: 'analytics',
  pets: 'pets',
  membership: 'membership',
  achievements: 'achievements',
  badges: 'badges',
  leaderboard: 'leaderboard',
  playbooks: 'playbooks',
  'journey-albums': 'journeyAlbums',
  share: 'share',
  speech: 'speech',
  'plan-sessions': 'planSessions',
  agent: 'agent',
};

/** 接口日志模块筛选项（与 i18n apiLog.module 键一致） */
export const API_LOG_MODULE_KEYS = [
  'auth',
  'status',
  'health',
  'system',
  'users',
  'routes',
  'checkins',
  'orders',
  'attractions',
  'analytics',
  'pets',
  'membership',
  'achievements',
  'badges',
  'leaderboard',
  'playbooks',
  'journeyAlbums',
  'share',
  'agentTools',
  'agentRoute',
  'speech',
  'planSessions',
  'other',
] as const;

export type ApiLogModuleKey = (typeof API_LOG_MODULE_KEYS)[number];

/** 各模块对应的请求 URL LIKE 模式（兼容未写入 api_module 的历史日志） */
const API_MODULE_URL_LIKE_PATTERNS: Record<string, string[]> = {
  auth: ['/api/auth%'],
  status: ['/api/status%'],
  health: ['/api/health%'],
  system: ['/api/system%'],
  users: ['/api/users%'],
  routes: ['/api/routes%'],
  checkins: ['/api/checkins%'],
  orders: ['/api/orders%'],
  attractions: ['/api/attractions%'],
  analytics: ['/api/analytics%'],
  pets: ['/api/pets%'],
  membership: ['/api/membership%'],
  achievements: ['/api/achievements%'],
  badges: ['/api/badges%'],
  leaderboard: ['/api/leaderboard%'],
  playbooks: ['/api/playbooks%'],
  journeyAlbums: ['/api/journey-albums%'],
  share: ['/api/share%'],
  agentTools: ['/api/agent/tools%'],
  agentRoute: ['/api/agent/route-intent%'],
  speech: ['/api/speech%'],
  planSessions: ['/api/plan-sessions%'],
};

/**
 * 获取全部已知模块的 URL LIKE 模式（用于「其他」模块筛选）。
 */
export function getAllKnownApiModuleUrlLikePatterns(): string[] {
  return Object.values(API_MODULE_URL_LIKE_PATTERNS).flat();
}

/**
 * 获取模块筛选用的 URL LIKE 模式列表。
 */
export function getApiModuleUrlLikePatterns(moduleKey: string): string[] {
  return API_MODULE_URL_LIKE_PATTERNS[moduleKey] ?? [];
}

/**
 * 判断模块键是否可用于筛选。
 */
export function isApiLogModuleKey(value: string): value is ApiLogModuleKey {
  return (API_LOG_MODULE_KEYS as readonly string[]).includes(value);
}

/**
 * 规范化 API 请求路径（去 query、去尾斜杠）。
 */
export function normalizeApiLogPath(requestUrl: string): string {
  const raw = requestUrl.split('?')[0] ?? requestUrl;
  if (!raw || raw === '/') return '/';
  return raw.replace(/\/+$/, '') || '/';
}

/**
 * 将带 `:param` 的路径模板转为正则。
 */
function pathPatternToRegExp(pattern: string): RegExp {
  const parts = pattern.split('/').map((segment) => {
    if (segment.startsWith(':')) return '[^/]+';
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^${parts.join('/')}$`);
}

function matchApiLogPath(pattern: string, path: string): boolean {
  if (!pattern.includes(':')) return pattern === path;
  return pathPatternToRegExp(pattern).test(path);
}

/**
 * 从路径首段推断模块 i18n 键。
 */
function inferModuleKeyFromPath(path: string): string {
  const segments = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  if (segments.length === 0) return 'other';
  if (segments[0] === 'agent') {
    if (segments[1] === 'tools') return 'agentTools';
    if (segments[1] === 'route-intent') return 'agentRoute';
    return 'agent';
  }
  return MODULE_SEGMENT_MAP[segments[0] ?? ''] ?? segments[0] ?? 'other';
}

/**
 * 解析接口日志的模块与功能描述键。
 */
export function resolveApiLogMeta(method: string, requestUrl: string): ApiLogMeta {
  const path = normalizeApiLogPath(requestUrl);
  const upperMethod = method.toUpperCase();

  for (const rule of API_LOG_ROUTE_RULES) {
    if (rule.methods && !rule.methods.includes(upperMethod)) continue;
    if (matchApiLogPath(rule.path, path)) {
      return { moduleKey: rule.moduleKey, descKey: rule.descKey };
    }
  }

  const moduleKey = inferModuleKeyFromPath(path);
  return { moduleKey, descKey: 'generic' };
}
