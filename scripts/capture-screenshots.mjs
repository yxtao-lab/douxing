/**
 * 兜行操作手册自动截图脚本
 *
 * 通过 Playwright 自动登录并访问三端各功能页面，输出 PNG 截图到
 * docs/操作手册/assets/{端}/ 目录，供操作手册 .docx 引用。
 *
 * 用法：node scripts/capture-screenshots.mjs [--only web|pc|mobile|partner|screen]
 *
 * 前置条件：后端(:3000)、Web(:5173)、PC(:5176)、Mobile H5(:5174) 已启动。
 *
 * @returns {Promise<void>} 无返回值；截图与失败清单写入磁盘
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'docs', '操作手册', 'assets');

const WEB = 'http://127.0.0.1:5173';
const PC = 'http://127.0.0.1:5176';
const MOBILE = 'http://127.0.0.1:5174';

const ACCOUNTS = {
  admin: { username: 'admin', password: 'admin123' },
  merchant: { username: 'merchant', password: 'merchant123' },
  demo: { username: 'demo', password: 'demo123' },
};

const failures = [];
let counter = 0;

/**
 * 等待页面稳定（网络空闲 + 防抖）。
 *
 * @param {import('playwright').Page} page - Playwright 页面对象
 * @param {number} [timeout=8000] - 最长等待毫秒
 * @returns {Promise<void>} 无返回值
 */
async function stable(page, timeout = 6000) {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch {
    /* 部分页面有长连接，忽略超时 */
  }
  // 等待 #app 渲染出内容（SPA 首屏挂载），但不死等
  try {
    await page.waitForFunction(() => {
      const app = document.querySelector('#app');
      if (!app) return false;
      return app.children.length > 0;
    }, { timeout: 4000 });
  } catch {
    /* 超时也继续，避免阻塞 */
  }
  await page.waitForTimeout(1200);
}

/**
 * 截图并自动编号保存。
 *
 * @param {import('playwright').Page} page - Playwright 页面对象
 * @param {string} dir - 端子目录名（web/pc/mobile）
 * @param {string} name - 截图语义名（英文/拼音，作文件名）
 * @returns {Promise<string>} 截图相对路径
 */
async function shot(page, dir, name) {
  counter += 1;
  const num = String(counter).padStart(2, '0');
  const file = path.join(ASSETS, dir, `${num}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/**
 * 调用后端登录 API 获取 token。
 *
 * @param {{username:string, password:string}} account - 登录账号
 * @returns {Promise<{token:string, refreshToken:string, user:object}>} 会话信息
 * @throws {Error} 登录失败时抛出
 */
async function loginViaApi(account) {
  const res = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(account),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body?.data?.token) throw new Error(`login no token: ${JSON.stringify(body).slice(0, 200)}`);
  return body.data;
}

/**
 * 密码登录通用流程：填表 → 提交 → 等待跳转（仅用于截图登录页交互态）。
 *
 * @param {import('playwright').Page} page - Playwright 页面对象
 * @param {{username:string, password:string}} account - 登录账号
 * @returns {Promise<void>} 无返回值
 */
async function passwordLogin(page, account) {
  for (const sel of [
    'text=密码登录',
    'text=账号登录',
    '.ant-tabs-tab:has-text("密码")',
    'button:has-text("密码")',
  ]) {
    try {
      await page.locator(sel).first().click({ timeout: 1500 });
      break;
    } catch { /* 尝试下一个选择器 */ }
  }
  await page.waitForTimeout(400);
  const u = page.locator('input[placeholder*="用户名"], input[placeholder*="账号"], input[type="text"]').first();
  await u.fill(account.username);
  const p = page.locator('input[type="password"], input[password]').first();
  await p.fill(account.password);
  await page.locator('button:has-text("登录"), button:has-text("Login"), button[type="submit"]').first().click();
  await page.waitForTimeout(1500);
  await stable(page);
}

/**
 * 通过 addInitScript 注入登录态到 localStorage，访问受保护页面时免登录。
 *
 * @param {import('playwright').BrowserContext} ctx - 浏览器上下文
 * @param {{username:string, password:string}} account - 登录账号
 * @returns {Promise<{token:string, refreshToken:string, user:object}>} 会话信息
 */
async function injectAuth(ctx, account) {
  const session = await loginViaApi(account);
  await ctx.addInitScript((s) => {
    localStorage.setItem('douxing_token', s.token);
    localStorage.setItem('douxing_refresh_token', s.refreshToken);
    localStorage.setItem('douxing_user', JSON.stringify(s.user));
  }, session);
  return session;
}

/**
 * 访问指定 URL 并截图（含失败捕获）。
 *
 * @param {import('playwright').Page} page - Playwright 页面对象
 * @param {string} dir - 端子目录
 * @param {string} name - 截图名
 * @param {string} url - 目标 URL
 * @returns {Promise<void>} 无返回值
 */
async function visit(page, dir, name, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    await stable(page);
    await shot(page, dir, name);
    console.log(`  ✓ ${dir}/${name}`);
  } catch (e) {
    failures.push({ dir, name, url, error: String(e).slice(0, 200) });
    console.log(`  ✗ ${dir}/${name}  ${String(e).slice(0, 120)}`);
  }
}

/**
 * 截图 Web 管理端（admin 账号）。
 *
 * @param {import('playwright').Browser} browser - 浏览器实例
 * @returns {Promise<void>} 无返回值
 */
async function captureWeb(browser) {
  console.log('\n[Web 管理端 admin]');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  await mkdir(path.join(ASSETS, 'web'), { recursive: true });
  counter = 0;
  // 登录页
  await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'web', 'login');
  // 注入登录态
  await injectAuth(ctx, ACCOUNTS.admin);
  await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'web', 'home-dashboard');
  // 各管理页
  const pages = [
    ['routes', '/routes'],
    ['orders', '/orders'],
    ['checkins', '/checkins'],
    ['checkins-map', '/checkins/map'],
    ['attractions-manage', '/attractions/manage'],
    ['attractions-pending', '/attractions/pending'],
    ['route-media-pending', '/attractions/media/pending'],
    ['playbooks-manage', '/playbooks/manage'],
    ['marketplace-demands', '/marketplace/demands'],
    ['marketplace-disputes', '/marketplace/disputes'],
    ['marketplace-orgs', '/marketplace/orgs'],
    ['marketplace-orgs-pending', '/marketplace/orgs/pending'],
    ['marketplace-providers-pending', '/marketplace/providers/pending'],
    ['membership-users', '/membership/users'],
    ['membership-products', '/membership/products'],
    ['membership-logs', '/membership/logs'],
    ['analytics', '/analytics'],
    ['workflow-templates', '/workflow-templates'],
    ['sys-users', '/system/users'],
    ['sys-roles', '/system/roles'],
    ['sys-menus', '/system/menus'],
    ['sys-depts', '/system/depts'],
    ['sys-posts', '/system/posts'],
    ['sys-dict', '/system/dict'],
    ['sys-config', '/system/config'],
    ['sys-notices', '/system/notices'],
    ['monitor-online', '/monitor/online'],
    ['monitor-jobs', '/monitor/jobs'],
    ['monitor-data', '/monitor/data'],
    ['monitor-server', '/monitor/server'],
    ['monitor-cache', '/monitor/cache'],
    ['log-oper', '/log/oper'],
    ['log-login', '/log/login'],
    ['log-api', '/log/api'],
    ['log-ai-service', '/log/ai-service'],
  ];
  for (const [name, p] of pages) {
    await visit(page, 'web', name, `${WEB}#${p}`);
  }
  await ctx.close();
}

/**
 * 截图 Web 商户工作台（merchant 账号）。
 *
 * @param {import('playwright').Browser} browser - 浏览器实例
 * @returns {Promise<void>} 无返回值
 */
async function capturePartner(browser) {
  console.log('\n[Web 商户工作台 merchant]');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  await mkdir(path.join(ASSETS, 'partner'), { recursive: true });
  counter = 0;
  await page.goto(`${WEB}/login?portal=partner`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'partner', 'login-partner');
  await injectAuth(ctx, ACCOUNTS.admin);
  await page.goto(`${WEB}/partner`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'partner', 'home');
  const pages = [
    ['onboard', '/partner/onboard'],
    ['demands', '/partner/demands'],
    ['quotes', '/partner/quotes'],
    ['orders', '/partner/orders'],
    ['settlements', '/partner/settlements'],
    ['schedule', '/partner/schedule'],
  ];
  for (const [name, p] of pages) {
    await visit(page, 'partner', name, `${WEB}#${p}`);
  }
  await ctx.close();
}

/**
 * 截图运营大屏（无需登录）。
 *
 * @param {import('playwright').Browser} browser - 浏览器实例
 * @returns {Promise<void>} 无返回值
 */
async function captureScreen(browser) {
  console.log('\n[运营大屏]');
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  await mkdir(path.join(ASSETS, 'screen'), { recursive: true });
  counter = 0;
  await visit(page, 'screen', 'travel-cockpit', `${WEB}/screen/travel`);
  await ctx.close();
}

/**
 * 截图 PC 用户端（demo 账号）。
 *
 * @param {import('playwright').Browser} browser - 浏览器实例
 * @returns {Promise<void>} 无返回值
 */
async function capturePC(browser) {
  console.log('\n[PC 用户端 demo]');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  await mkdir(path.join(ASSETS, 'pc'), { recursive: true });
  counter = 0;
  await page.goto(`${PC}/login`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'pc', 'login');
  await injectAuth(ctx, ACCOUNTS.demo);
  await page.goto(`${PC}/`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'pc', 'home');
  const pages = [
    ['plan', '/plan'],
    ['routes', '/routes'],
    ['route-detail', '/routes/1'],
    ['profile', '/profile'],
    ['profile-edit', '/profile/edit'],
    ['membership', '/profile/membership'],
    ['pet-memories', '/profile/pet-memories'],
    ['journey-albums', '/journey-albums'],
    ['journey-album-detail', '/journey-albums/1'],
    ['achievements', '/achievements'],
    ['badges', '/badges'],
    ['checkins', '/checkins'],
    ['checkins-map', '/checkins/map'],
    ['leaderboard', '/leaderboard'],
    ['orders', '/orders'],
    ['marketplace-hall', '/marketplace'],
    ['marketplace-create', '/marketplace/create'],
    ['marketplace-mine', '/marketplace/mine'],
    ['marketplace-groups', '/marketplace/groups'],
    ['marketplace-group-create', '/marketplace/groups/create'],
    ['marketplace-product-detail', '/marketplace/products/1'],
  ];
  for (const [name, p] of pages) {
    await visit(page, 'pc', name, `${PC}${p}`);
  }
  await ctx.close();
}

/**
 * 截图移动端样式界面（demo 账号，移动视口）。
 *
 * 注：移动端 UniApp H5 在当前 dev 环境存在 vite 模块导出错误无法渲染，
 * 改用 PC 用户端（功能与移动端对齐）+ 移动视口 375x812 截图，
 * 作为移动端操作手册的界面示意。
 *
 * @param {import('playwright').Browser} browser - 浏览器实例
 * @returns {Promise<void>} 无返回值
 */
async function captureMobile(browser) {
  console.log('\n[移动端 H5 demo]');
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const page = await ctx.newPage();
  await mkdir(path.join(ASSETS, 'mobile'), { recursive: true });
  counter = 0;
  // 登录页（移动视口）
  await page.goto(`${PC}/login`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'mobile', 'login');
  // 注入登录态
  await injectAuth(ctx, ACCOUNTS.demo);
  await page.goto(`${PC}/`, { waitUntil: 'domcontentloaded' });
  await stable(page);
  await shot(page, 'mobile', 'home');
  const pages = [
    ['plan', '/plan'],
    ['routes-list', '/routes'],
    ['route-detail', '/routes/1'],
    ['profile', '/profile'],
    ['profile-edit', '/profile/edit'],
    ['membership', '/profile/membership'],
    ['pet-memories', '/profile/pet-memories'],
    ['journey-albums', '/journey-albums'],
    ['journey-album-detail', '/journey-albums/1'],
    ['achievements', '/achievements'],
    ['badges', '/badges'],
    ['checkins-list', '/checkins'],
    ['checkins-map', '/checkins/map'],
    ['leaderboard', '/leaderboard'],
    ['orders-list', '/orders'],
    ['marketplace-hall', '/marketplace'],
    ['marketplace-create', '/marketplace/create'],
    ['marketplace-mine', '/marketplace/mine'],
    ['marketplace-groups', '/marketplace/groups'],
    ['marketplace-group-create', '/marketplace/groups/create'],
    ['marketplace-product-detail', '/marketplace/products/1'],
  ];
  for (const [name, p] of pages) {
    await visit(page, 'mobile', name, `${PC}${p}`);
  }
  await ctx.close();
}

const only = process.argv.slice(2).find((a) => a.startsWith('--only='))?.split('=')[1];

const browser = await chromium.launch({ headless: true });
try {
  if (!only || only === 'web') await captureWeb(browser);
  if (!only || only === 'partner') await capturePartner(browser);
  if (!only || only === 'screen') await captureScreen(browser);
  if (!only || only === 'pc') await capturePC(browser);
  if (!only || only === 'mobile') await captureMobile(browser);
} finally {
  await browser.close();
}

console.log(`\n完成。失败 ${failures.length} 项：`);
for (const f of failures) console.log(`  - ${f.dir}/${f.name}: ${f.url}`);
