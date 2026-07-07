export type ChangelogType = 'major' | 'feature' | 'fix';

export interface WorkbenchSiteItem {
  id: string;
  titleKey: string;
  descKey: string;
  tagKeys: string[];
  emoji: string;
  to?: string;
  href?: string;
}

export interface WorkbenchChangelogItem {
  id: string;
  versionKey: string;
  type: ChangelogType;
  dateKey: string;
  pointKeys: string[];
}

export interface WorkbenchQuickAction {
  id: string;
  labelKey: string;
  to: string;
  icon: 'routes' | 'checkinMap' | 'attractions' | 'playbooks';
  /** 与路由 meta.perm / sys_menu.perms 对齐 */
  perm: string;
}

export interface WorkbenchStatItem {
  key: 'routes' | 'orders' | 'checkins' | 'pending';
  titleKey: string;
  perm: string;
}

export const WORKBENCH_STATS: WorkbenchStatItem[] = [
  { key: 'routes', titleKey: 'home.statRoutes', perm: 'biz:routes:list' },
  { key: 'orders', titleKey: 'home.statOrders', perm: 'biz:orders:list' },
  { key: 'checkins', titleKey: 'home.statCheckins', perm: 'biz:checkins:list' },
  { key: 'pending', titleKey: 'home.statPending', perm: 'content:attractions:pending' },
];

export const WORKBENCH_SITES: WorkbenchSiteItem[] = [
  {
    id: 'mobile',
    titleKey: 'home.sites.mobile.title',
    descKey: 'home.sites.mobile.desc',
    tagKeys: ['home.sites.mobile.tag1', 'home.sites.mobile.tag2', 'home.sites.mobile.tag3'],
    emoji: '📱',
  },
  {
    id: 'pc',
    titleKey: 'home.sites.pc.title',
    descKey: 'home.sites.pc.desc',
    tagKeys: ['home.sites.pc.tag1', 'home.sites.pc.tag2', 'home.sites.pc.tag3'],
    emoji: '💻',
  },
  {
    id: 'web',
    titleKey: 'home.sites.web.title',
    descKey: 'home.sites.web.desc',
    tagKeys: ['home.sites.web.tag1', 'home.sites.web.tag2'],
    emoji: '🖥️',
    to: '/',
  },
  {
    id: 'api',
    titleKey: 'home.sites.api.title',
    descKey: 'home.sites.api.desc',
    tagKeys: ['home.sites.api.tag1', 'home.sites.api.tag2'],
    emoji: '⚡',
    href: '/api/health',
  },
];

export const WORKBENCH_CHANGELOG: WorkbenchChangelogItem[] = [
  {
    id: '1.0.0',
    versionKey: 'home.changelog.v100.version',
    type: 'feature',
    dateKey: 'home.changelog.v100.date',
    pointKeys: [
      'home.changelog.v100.p1',
      'home.changelog.v100.p2',
      'home.changelog.v100.p3',
      'home.changelog.v100.p4',
      'home.changelog.v100.p5',
    ],
  },
  {
    id: '0.9.0',
    versionKey: 'home.changelog.v090.version',
    type: 'fix',
    dateKey: 'home.changelog.v090.date',
    pointKeys: ['home.changelog.v090.p1', 'home.changelog.v090.p2', 'home.changelog.v090.p3'],
  },
  {
    id: '0.8.0',
    versionKey: 'home.changelog.v080.version',
    type: 'feature',
    dateKey: 'home.changelog.v080.date',
    pointKeys: ['home.changelog.v080.p1', 'home.changelog.v080.p2'],
  },
];

export const WORKBENCH_QUICK_ACTIONS: WorkbenchQuickAction[] = [
  { id: 'routes', labelKey: 'web.routes', to: '/routes', icon: 'routes', perm: 'biz:routes:list' },
  {
    id: 'checkinMap',
    labelKey: 'web.checkinMap',
    to: '/checkins/map',
    icon: 'checkinMap',
    perm: 'biz:checkins:map',
  },
  {
    id: 'attractionsPending',
    labelKey: 'web.attractionsPending',
    to: '/attractions/pending',
    icon: 'attractions',
    perm: 'content:attractions:pending',
  },
  {
    id: 'routeMediaPending',
    labelKey: 'web.routeMediaPending',
    to: '/attractions/media/pending',
    icon: 'attractions',
    perm: 'content:attractions:pending',
  },
  {
    id: 'attractionsManage',
    labelKey: 'web.attractionsManage',
    to: '/attractions/manage',
    icon: 'attractions',
    perm: 'content:attractions:manage',
  },
  {
    id: 'playbooks',
    labelKey: 'web.playbooksManage',
    to: '/playbooks/manage',
    icon: 'playbooks',
    perm: 'content:playbooks:list',
  },
];
