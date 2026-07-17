import { readFile, stat, readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, relative } from 'node:path';
import type {
  SystemResourceDocStat,
  SystemResourceFileTypeStat,
  SystemResourceMetricItem,
  SystemResourcePackageStat,
  SystemResourcesStats,
} from '@douxing/shared';
import {
  attachCumulativeTotalLines,
  collectGitCommitStats,
  ensureRemoteGitCheckout,
} from './system-resources-git.js';

/**
 * 将相对路径统一为正斜杠，便于前端展示与匹配。
 *
 * @param p - 任意相对路径
 * @returns 正斜杠路径
 */
function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** 源代码扩展名（用于「源代码」口径统计） */
const SOURCE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'vue']);
/** 全部参与统计的扩展名（含 json/css/md/html/mdc 等资源类） */
const TRACKED_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'vue', 'json', 'css', 'scss', 'html', 'md', 'mdc']);
/** monorepo 子包目录名 → 包展示名（前端三端 + 后端 + 共享） */
const PACKAGE_DIRS = ['mobile', 'web', 'pc', 'server', 'shared'] as const;
/** 额外代码包（Python / 训练等，按可统计扩展名扫描） */
const EXTRA_PACKAGE_DIRS = ['ai-service', 'ml-training'] as const;
/** 文档/规则类资源目录（相对项目根） */
const DOC_DIRS = ['docs', '.cursor/rules', '.cursor/skills'] as const;
/** 业务模块扫描配置：name 为展示名，relPath 相对项目根，ext 扩展名 */
const MODULE_SCAN_TARGETS: ReadonlyArray<{ name: string; relPath: string; ext: string }> = [
  { name: 'server/services', relPath: 'packages/server/src/services', ext: 'ts' },
  { name: 'server/routes', relPath: 'packages/server/src/routes', ext: 'ts' },
  { name: 'web/api', relPath: 'packages/web/src/api', ext: 'ts' },
  { name: 'web/composables', relPath: 'packages/web/src/composables', ext: 'ts' },
  { name: 'pc/api', relPath: 'packages/pc/src/api', ext: 'ts' },
  { name: 'pc/composables', relPath: 'packages/pc/src/composables', ext: 'ts' },
  { name: 'mobile/api', relPath: 'packages/mobile/src/api', ext: 'ts' },
  { name: 'mobile/composables', relPath: 'packages/mobile/src/composables', ext: 'ts' },
];
/** 额外参与「扩展包」扫描的扩展名（Python 等） */
const EXTRA_SOURCE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'vue', 'py', 'mjs', 'cjs']);

/** 跳过的目录名（递归扫描时忽略） */
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.vite',
  'build',
  'coverage',
  '.turbo',
  'unpackage',
  '.cache',
  'tmp',
  'temp',
  'logs',
  '__pycache__',
  '.venv',
  'venv',
  'datasets',
  '.pytest_cache',
  'site-packages',
  '.nuxt',
  '.output',
  'uploads',
  'media',
]);

/** 单次扫描最大文件数（防止失控） */
const MAX_FILES = 20000;
/** 单文件最大计入行数（避免误扫超大文件） */
const MAX_LINES_PER_FILE = 200000;

interface ScanAccumulator {
  fileTypes: Map<string, { ext: string; fileCount: number; lineCount: number }>;
  totalFiles: number;
  totalLines: number;
  sourceFiles: number;
  sourceLines: number;
}

/**
 * 递归扫描目录，按扩展名累加文件数与行数。
 *
 * @param dir - 起始目录绝对路径
 * @param acc - 累加器
 * @param root - 项目根目录，用于计算相对路径与跳过 node_modules
 * @param onlyExt - 仅统计指定扩展名（可选）；未传则统计 TRACKED_EXTS
 * @returns 是否正常完成（未触发上限）
 */
async function scanDir(
  dir: string,
  acc: ScanAccumulator,
  root: string,
  onlyExt?: Set<string>,
): Promise<boolean> {
  if (acc.totalFiles >= MAX_FILES) return false;

  let entries: import('node:fs').Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true }) as unknown as import('node:fs').Dirent[];
  } catch {
    return true;
  }

  for (const entry of entries) {
    if (acc.totalFiles >= MAX_FILES) return false;

    const name = entry.name as unknown as string;
    const fullPath = join(dir, name);

    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(name)) continue;
      // 跳过项目根下的非 packages 目录中无关大目录
      const rel = relative(root, fullPath);
      if (rel === 'packages' || rel.startsWith('packages')) {
        // packages 下继续
      } else if (
        rel.startsWith('docs') ||
        rel.startsWith('.cursor') ||
        rel === 'scripts' ||
        rel === 'schemas'
      ) {
        // 允许
      } else if (name.startsWith('.') && name !== '.cursor') {
        continue;
      }
      const ok = await scanDir(fullPath, acc, root, onlyExt);
      if (!ok) return false;
      continue;
    }

    if (!entry.isFile()) continue;
    const dot = name.lastIndexOf('.');
    if (dot <= 0) continue;
    const ext = name.slice(dot + 1).toLowerCase();
    // onlyExt 可扩展 TRACKED_EXTS 之外的类型（如 .py）；未传 onlyExt 时仅统计 TRACKED_EXTS
    if (onlyExt) {
      if (!onlyExt.has(ext)) continue;
    } else if (!TRACKED_EXTS.has(ext)) {
      continue;
    }

    let lineCount = 0;
    try {
      lineCount = await countLines(fullPath);
    } catch {
      lineCount = 0;
    }

    const bucket = acc.fileTypes.get(ext) ?? { ext, fileCount: 0, lineCount: 0 };
    bucket.fileCount += 1;
    bucket.lineCount += lineCount;
    acc.fileTypes.set(ext, bucket);
    acc.totalFiles += 1;
    acc.totalLines += lineCount;
    if (SOURCE_EXTS.has(ext)) {
      acc.sourceFiles += 1;
      acc.sourceLines += lineCount;
    }
  }
  return true;
}

/**
 * 统计文件行数：小文件一次性读入；大文件流式计数，避免占内存。
 *
 * @param filePath - 文件绝对路径
 * @returns 行数；超过 MAX_LINES_PER_FILE 时截断；读失败为 0
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const st = await stat(filePath);
    // 超过 2MB 的文件用流式；否则一次性读入更快
    if (st.size > 2 * 1024 * 1024) {
      return countLinesStream(filePath);
    }
    const content = await readFile(filePath, 'utf8');
    if (!content) return 0;
    let count = 1;
    for (let i = 0; i < content.length; i += 1) {
      if (content.charCodeAt(i) === 10) count += 1;
      if (count >= MAX_LINES_PER_FILE) return MAX_LINES_PER_FILE;
    }
    // 末尾恰为换行时多算一行，对齐常见 wc -l 行为：按换行符数量
    if (content.endsWith('\n') || content.endsWith('\r\n')) count -= 1;
    return count;
  } catch {
    return 0;
  }
}

/**
 * 流式统计大文件行数。
 *
 * @param filePath - 文件绝对路径
 * @returns 行数；超过上限时截断
 */
async function countLinesStream(filePath: string): Promise<number> {
  return new Promise((resolveCount) => {
    let count = 0;
    let aborted = false;
    const stream = createReadStream(filePath, { encoding: 'utf8' });
    const rl = createInterface({ crlfDelay: Infinity, input: stream });
    rl.on('line', () => {
      count += 1;
      if (count >= MAX_LINES_PER_FILE) {
        aborted = true;
        rl.close();
        stream.destroy();
      }
    });
    rl.on('close', () => resolveCount(count));
    rl.on('error', () => resolveCount(aborted ? count : 0));
  });
}

/**
 * 统计单个子包目录下源代码规模。
 *
 * @param pkgName - 包展示名
 * @param pkgPath - 包根目录绝对路径
 * @param root - 项目根目录
 * @returns 该包源代码文件数与行数
 */
async function scanPackage(
  pkgName: string,
  pkgPath: string,
  root: string,
): Promise<SystemResourcePackageStat> {
  const acc: ScanAccumulator = {
    fileTypes: new Map(),
    totalFiles: 0,
    totalLines: 0,
    sourceFiles: 0,
    sourceLines: 0,
  };
  await scanDir(pkgPath, acc, root, SOURCE_EXTS);
  return {
    name: pkgName,
    path: toPosixPath(relative(root, pkgPath) || pkgName),
    fileCount: acc.sourceFiles,
    lineCount: acc.sourceLines,
  };
}

/**
 * 统计指定目录下文档/资源类文件（.md/.json/.css/.html 等）规模。
 *
 * @param dirPath - 目录绝对路径
 * @param root - 项目根目录
 * @returns 该目录文档统计；目录不存在时返回 0
 */
async function scanDocDir(dirPath: string, root: string): Promise<SystemResourceDocStat> {
  const rel = toPosixPath(relative(root, dirPath) || dirPath);
  try {
    await stat(dirPath);
  } catch {
    return { path: rel, fileCount: 0, lineCount: 0 };
  }
  const acc: ScanAccumulator = {
    fileTypes: new Map(),
    totalFiles: 0,
    totalLines: 0,
    sourceFiles: 0,
    sourceLines: 0,
  };
  await scanDir(dirPath, acc, root);
  return {
    path: rel,
    fileCount: acc.totalFiles,
    lineCount: acc.totalLines,
  };
}

/**
 * 统计指定目录下某扩展名文件数与行数（用于组件/页面统计）。
 *
 * @param dirPath - 目录绝对路径
 * @param ext - 扩展名（不含点）
 * @param root - 项目根目录
 * @returns 文件数与行数
 */
async function scanDirByExt(
  dirPath: string,
  ext: string,
  root: string,
): Promise<{ fileCount: number; lineCount: number }> {
  const acc: ScanAccumulator = {
    fileTypes: new Map(),
    totalFiles: 0,
    totalLines: 0,
    sourceFiles: 0,
    sourceLines: 0,
  };
  await scanDir(dirPath, acc, root, new Set([ext]));
  return { fileCount: acc.totalFiles, lineCount: acc.totalLines };
}

/**
 * 读取 package.json 的 dependencies + devDependencies 数量。
 *
 * @param pkgPath - package.json 绝对路径
 * @returns 依赖总数；读取失败为 0
 */
async function countPackageDeps(pkgPath: string): Promise<number> {
  try {
    const content = await readFile(pkgPath, 'utf8');
    const json = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const deps = Object.keys(json.dependencies ?? {}).length;
    const devDeps = Object.keys(json.devDependencies ?? {}).length;
    const peerDeps = Object.keys(json.peerDependencies ?? {}).length;
    return deps + devDeps + peerDeps;
  } catch {
    return 0;
  }
}

/**
 * 统计 i18n locale 文件中顶层 key 数量（粗略估算文案规模）。
 *
 * @param localePath - locale 文件绝对路径
 * @returns 顶层 key 数量；读取失败为 0
 */
async function countI18nKeys(localePath: string): Promise<number> {
  try {
    const content = await readFile(localePath, 'utf8');
    // 粗略统计形如 `  key: {` 或 `  key: '...'` 的顶层键（2 空格缩进）
    const matches = content.match(/^\s{2}[A-Za-z_][\w]*\s*:/gm);
    return matches ? matches.length : 0;
  } catch {
    return 0;
  }
}

/**
 * 统计后端路由文件数（packages/server/src/routes 下 .ts 文件，含子目录）。
 *
 * @param root - 项目根目录
 * @returns 路由文件数
 */
async function countApiRoutes(root: string): Promise<number> {
  const routesDir = join(root, 'packages/server/src/routes');
  const { fileCount } = await scanDirByExt(routesDir, 'ts', root);
  return fileCount;
}

/**
 * 统计目录下一级子目录数量（用于 Cursor skills 等「插件包」口径）。
 *
 * @param dirPath - 目录绝对路径
 * @returns 子目录数；目录不存在为 0
 */
async function countChildDirectories(dirPath: string): Promise<number> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).length;
  } catch {
    return 0;
  }
}

/**
 * 扫描单个业务模块目录，返回展示名与规模。
 *
 * @param name - 模块展示名
 * @param dirPath - 目录绝对路径
 * @param ext - 扩展名（不含点）
 * @param root - 项目根目录
 * @returns 模块统计；目录不存在时 fileCount/lineCount 为 0
 */
async function scanModuleTarget(
  name: string,
  dirPath: string,
  ext: string,
  root: string,
): Promise<SystemResourcePackageStat> {
  try {
    await stat(dirPath);
  } catch {
    return { name, path: toPosixPath(relative(root, dirPath)), fileCount: 0, lineCount: 0 };
  }
  const { fileCount, lineCount } = await scanDirByExt(dirPath, ext, root);
  return {
    name,
    path: toPosixPath(relative(root, dirPath)),
    fileCount,
    lineCount,
  };
}

/**
 * 扫描扩展代码包（如 ai-service / ml-training），按 EXTRA_SOURCE_EXTS 统计。
 *
 * @param pkgName - 包展示名
 * @param pkgPath - 包根目录绝对路径
 * @param root - 项目根目录
 * @returns 该包文件数与行数；目录不存在时返回 0
 */
async function scanExtraPackage(
  pkgName: string,
  pkgPath: string,
  root: string,
): Promise<SystemResourcePackageStat> {
  try {
    await stat(pkgPath);
  } catch {
    return { name: pkgName, path: toPosixPath(relative(root, pkgPath)), fileCount: 0, lineCount: 0 };
  }
  const acc: ScanAccumulator = {
    fileTypes: new Map(),
    totalFiles: 0,
    totalLines: 0,
    sourceFiles: 0,
    sourceLines: 0,
  };
  await scanDir(pkgPath, acc, root, EXTRA_SOURCE_EXTS);
  return {
    name: pkgName,
    path: toPosixPath(relative(root, pkgPath) || pkgName),
    fileCount: acc.totalFiles,
    lineCount: acc.totalLines,
  };
}

let cachedStats: SystemResourcesStats | null = null;
let cachePromise: Promise<SystemResourcesStats> | null = null;
let cacheExpireAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 基于远程 Git HEAD 快照聚合系统资源统计（带 5 分钟内存缓存）。
 *
 * 数据来自浅克隆的远程仓库工作树，不扫描本机业务工作区源码。
 *
 * @param forceRefresh - 是否强制 fetch 远程并刷新缓存
 * @returns 系统资源统计结果
 */
export async function getSystemResourcesStats(
  forceRefresh = false,
): Promise<SystemResourcesStats> {
  const now = Date.now();
  if (!forceRefresh && cachedStats && now < cacheExpireAt) {
    return cachedStats;
  }
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const checkout = await ensureRemoteGitCheckout(forceRefresh);
    const root = checkout.workTree;
    const gitStats = await collectGitCommitStats(root);
    let { commitTrends, moduleChurn } = gitStats;

    // 1. 各子包源代码规模（核心 5 包 + 扩展包）
    const packages: SystemResourcePackageStat[] = [];
    for (const pkg of PACKAGE_DIRS) {
      const pkgPath = join(root, 'packages', pkg);
      packages.push(await scanPackage(pkg, pkgPath, root));
    }
    for (const pkg of EXTRA_PACKAGE_DIRS) {
      const pkgPath = join(root, 'packages', pkg);
      const extra = await scanExtraPackage(pkg, pkgPath, root);
      if (extra.fileCount > 0) packages.push(extra);
    }

    // 2. 全项目按扩展名聚合（仅核心 5 包）
    const allAcc: ScanAccumulator = {
      fileTypes: new Map(),
      totalFiles: 0,
      totalLines: 0,
      sourceFiles: 0,
      sourceLines: 0,
    };
    for (const pkg of PACKAGE_DIRS) {
      await scanDir(join(root, 'packages', pkg), allAcc, root);
    }
    const fileTypes: SystemResourceFileTypeStat[] = [...allAcc.fileTypes.values()].sort(
      (a, b) => b.lineCount - a.lineCount,
    );

    // 3. 文档/规则目录
    const docs: SystemResourceDocStat[] = [];
    for (const docDir of DOC_DIRS) {
      docs.push(await scanDocDir(join(root, docDir), root));
    }

    // 4. 各端组件数
    const componentsByApp: SystemResourcePackageStat[] = [];
    for (const pkg of PACKAGE_DIRS) {
      if (pkg === 'server' || pkg === 'shared') continue;
      const compDir = join(root, 'packages', pkg, 'src/components');
      const { fileCount, lineCount } = await scanDirByExt(compDir, 'vue', root);
      componentsByApp.push({
        name: pkg,
        path: toPosixPath(relative(root, compDir)),
        fileCount,
        lineCount,
      });
    }

    // 5. 各端页面数
    const pagesByApp: SystemResourcePackageStat[] = [];
    for (const pkg of PACKAGE_DIRS) {
      if (pkg === 'server' || pkg === 'shared') continue;
      const pageDirName = pkg === 'mobile' ? 'pages' : 'views';
      const pageDir = join(root, 'packages', pkg, 'src', pageDirName);
      const { fileCount, lineCount } = await scanDirByExt(pageDir, 'vue', root);
      pagesByApp.push({
        name: pkg,
        path: toPosixPath(relative(root, pageDir)),
        fileCount,
        lineCount,
      });
    }

    // 6. 业务模块
    const modules: SystemResourcePackageStat[] = [];
    for (const target of MODULE_SCAN_TARGETS) {
      modules.push(
        await scanModuleTarget(target.name, join(root, target.relPath), target.ext, root),
      );
    }

    // 7. 插件 / 扩展资源
    const plugins: SystemResourcePackageStat[] = [];
    const skillsDir = join(root, '.cursor/skills');
    const skillCount = await countChildDirectories(skillsDir);
    const skillsDoc = await scanDocDir(skillsDir, root);
    plugins.push({
      name: 'cursor-skills',
      path: '.cursor/skills',
      fileCount: skillCount,
      lineCount: skillsDoc.lineCount,
    });
    const rulesDoc = docs.find((d) => toPosixPath(d.path) === '.cursor/rules') ?? {
      path: '.cursor/rules',
      fileCount: 0,
      lineCount: 0,
    };
    plugins.push({
      name: 'cursor-rules',
      path: rulesDoc.path,
      fileCount: rulesDoc.fileCount,
      lineCount: rulesDoc.lineCount,
    });
    const scriptsStat = await scanDocDir(join(root, 'scripts'), root);
    plugins.push({
      name: 'scripts',
      path: 'scripts',
      fileCount: scriptsStat.fileCount,
      lineCount: scriptsStat.lineCount,
    });

    // 8. API 路由文件数
    const apiRouteCount = await countApiRoutes(root);

    // 9. i18n
    const i18nKeys: SystemResourceMetricItem[] = [];
    i18nKeys.push({
      labelKey: 'systemResources.i18nZhCN',
      value: await countI18nKeys(join(root, 'packages/shared/src/i18n/locales/zh-CN.ts')),
    });
    i18nKeys.push({
      labelKey: 'systemResources.i18nEnUS',
      value: await countI18nKeys(join(root, 'packages/shared/src/i18n/locales/en-US.ts')),
    });

    // 10. 依赖
    const dependencies: SystemResourcePackageStat[] = [];
    const rootPkg = await countPackageDeps(join(root, 'package.json'));
    dependencies.push({ name: 'root', path: 'package.json', fileCount: 0, lineCount: rootPkg });
    for (const pkg of PACKAGE_DIRS) {
      const depCount = await countPackageDeps(join(root, 'packages', pkg, 'package.json'));
      dependencies.push({
        name: pkg,
        path: `packages/${pkg}/package.json`,
        fileCount: 0,
        lineCount: depCount,
      });
    }

    // 11. 概览
    const totalSourceLines = packages.reduce((sum, p) => sum + p.lineCount, 0);
    const totalSourceFiles = packages.reduce((sum, p) => sum + p.fileCount, 0);
    commitTrends = attachCumulativeTotalLines(commitTrends, totalSourceLines);
    const totalDocFiles = docs.reduce((sum, d) => sum + d.fileCount, 0);
    const totalDocLines = docs.reduce((sum, d) => sum + d.lineCount, 0);
    const totalComponents = componentsByApp.reduce((sum, c) => sum + c.fileCount, 0);
    const totalPages = pagesByApp.reduce((sum, p) => sum + p.fileCount, 0);
    const totalDeps = dependencies.reduce((sum, d) => sum + d.lineCount, 0);
    const totalModules = modules.reduce((sum, m) => sum + m.fileCount, 0);
    const totalPlugins = plugins.reduce((sum, p) => sum + p.fileCount, 0);
    const totalInsertions = commitTrends.reduce((s, d) => s + d.sourceInsertions, 0);
    const totalDeletions = commitTrends.reduce((s, d) => s + d.sourceDeletions, 0);
    const overview: SystemResourceMetricItem[] = [
      {
        labelKey: 'systemResources.overviewSourceFiles',
        value: totalSourceFiles,
        descKey: 'systemResources.overviewSourceFilesDesc',
      },
      {
        labelKey: 'systemResources.overviewSourceLines',
        value: totalSourceLines,
        descKey: 'systemResources.overviewSourceLinesDesc',
      },
      {
        labelKey: 'systemResources.overviewComponents',
        value: totalComponents,
        descKey: 'systemResources.overviewComponentsDesc',
      },
      {
        labelKey: 'systemResources.overviewPages',
        value: totalPages,
        descKey: 'systemResources.overviewPagesDesc',
      },
      {
        labelKey: 'systemResources.overviewModules',
        value: totalModules,
        descKey: 'systemResources.overviewModulesDesc',
      },
      {
        labelKey: 'systemResources.overviewPlugins',
        value: totalPlugins,
        descKey: 'systemResources.overviewPluginsDesc',
      },
      {
        labelKey: 'systemResources.overviewApiRoutes',
        value: apiRouteCount,
        descKey: 'systemResources.overviewApiRoutesDesc',
      },
      {
        labelKey: 'systemResources.overviewDocs',
        value: totalDocFiles,
        descKey: 'systemResources.overviewDocsDesc',
      },
      {
        labelKey: 'systemResources.overviewDocLines',
        value: totalDocLines,
        descKey: 'systemResources.overviewDocLinesDesc',
      },
      {
        labelKey: 'systemResources.overviewDeps',
        value: totalDeps,
        descKey: 'systemResources.overviewDepsDesc',
      },
      {
        labelKey: 'systemResources.overviewInsertions',
        value: totalInsertions,
        descKey: 'systemResources.overviewInsertionsDesc',
      },
      {
        labelKey: 'systemResources.overviewDeletions',
        value: totalDeletions,
        descKey: 'systemResources.overviewDeletionsDesc',
      },
    ];

    cachedStats = {
      source: 'git-remote',
      remoteUrl: checkout.remoteUrl,
      branch: checkout.branch,
      commitSha: checkout.commitSha,
      commitAt: checkout.commitAt,
      commitTrends,
      moduleChurn,
      packages,
      fileTypes,
      docs,
      componentsByApp,
      pagesByApp,
      modules,
      plugins,
      apiRouteCount,
      i18nKeys,
      dependencies,
      overview,
      generatedAt: new Date().toISOString(),
      projectRoot: checkout.remoteUrl,
    };
    cacheExpireAt = Date.now() + CACHE_TTL_MS;
    return cachedStats;
  })();

  try {
    return await cachePromise;
  } finally {
    cachePromise = null;
  }
}
