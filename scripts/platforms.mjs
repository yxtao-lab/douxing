/**
 * 兜行多端平台定义（开发 / 构建 / 产物路径）
 */

export const PLATFORMS = {
  server: {
    id: 'server',
    label: '后端 API',
    group: 'backend',
    dev: { shell: 'pnpm dev:server' },
    build: { shell: 'pnpm --filter @douxing/server build' },
    port: () => Number(process.env.SERVER_PORT) || 3000,
    output: null,
  },
  web: {
    id: 'web',
    label: 'Web 管理端',
    group: 'frontend',
    dev: { shell: 'pnpm dev:web' },
    build: { shell: 'pnpm --filter @douxing/web build' },
    port: () => 5173,
    output: 'packages/web/dist',
  },
  mobile: {
    id: 'mobile',
    label: '移动端 H5',
    group: 'frontend',
    aliases: ['h5'],
    dev: { shell: 'pnpm dev:mobile' },
    build: { shell: 'pnpm --filter @douxing/mobile build:h5' },
    port: () => 5174,
    output: 'packages/mobile/dist/build/h5',
  },
  'mp-weixin': {
    id: 'mp-weixin',
    label: '微信小程序',
    group: 'frontend',
    aliases: ['mp', 'weixin'],
    dev: { shell: 'pnpm dev:mp-weixin' },
    build: { shell: 'pnpm --filter @douxing/mobile build:mp-weixin' },
    port: null,
    output: 'packages/mobile/dist/build/mp-weixin',
  },
  'app-android': {
    id: 'app-android',
    label: 'Android App',
    group: 'native',
    aliases: ['android'],
    dev: { shell: 'pnpm dev:app-android' },
    build: { shell: 'pnpm --filter @douxing/mobile build:app-android' },
    port: () => 5175,
    output: 'packages/mobile/dist/build/app',
    releaseDir: 'packages/mobile/dist/release/android',
  },
  'app-ios': {
    id: 'app-ios',
    label: 'iOS App',
    group: 'native',
    aliases: ['ios'],
    dev: { shell: 'pnpm dev:app-ios' },
    build: { shell: 'pnpm --filter @douxing/mobile build:app-ios' },
    port: () => 5175,
    output: 'packages/mobile/dist/build/app',
    releaseDir: 'packages/mobile/dist/release/ios',
  },
  app: {
    id: 'app',
    label: '原生 App（Android + iOS 资源）',
    group: 'native',
    aliases: ['native'],
    dev: { shell: 'pnpm dev:app' },
    build: { shell: 'pnpm --filter @douxing/mobile build:app' },
    port: () => 5175,
    output: 'packages/mobile/dist/build/app',
  },
};

/** 一键原生部署包含的平台 */
export const NATIVE_DEPLOY_TARGETS = ['app-android', 'app-ios'];

const aliasMap = new Map();
for (const p of Object.values(PLATFORMS)) {
  aliasMap.set(p.id, p.id);
  for (const a of p.aliases ?? []) {
    aliasMap.set(a, p.id);
  }
}

export function resolvePlatformId(name) {
  const key = String(name).trim().toLowerCase();
  return aliasMap.get(key) ?? null;
}

export function resolvePlatformList(input) {
  if (!input || input.length === 0) return [];
  const ids = new Set();
  for (const part of input) {
    for (const token of part.split(',')) {
      const id = resolvePlatformId(token);
      if (!id) throw new Error(`未知平台: ${token}`);
      ids.add(id);
    }
  }
  return [...ids];
}

export function listPlatformHelp() {
  const lines = ['可用平台标识：'];
  for (const p of Object.values(PLATFORMS)) {
    const als = p.aliases?.length ? `（别名: ${p.aliases.join(', ')}）` : '';
    lines.push(`  - ${p.id}: ${p.label}${als}`);
  }
  lines.push('');
  lines.push('组合示例:');
  lines.push('  pnpm dev:only server,mobile');
  lines.push('  pnpm dev:only app-android');
  lines.push('  pnpm deploy:app');
  lines.push('  pnpm build:app-all');
  return lines.join('\n');
}
