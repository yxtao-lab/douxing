import { ApiError, ApiMessageKey } from '@douxing/shared';
import type {
  SystemResourceCommitDayStat,
  SystemResourceModuleChurnStat,
} from '@douxing/shared';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** 默认浅克隆深度（用于提交趋势） */
const DEFAULT_GIT_DEPTH = 120;
/** git 命令超时（毫秒） */
const GIT_TIMEOUT_MS = 180_000;

export interface RemoteGitCheckout {
  /** 本地临时工作树绝对路径（仅服务端内部使用） */
  workTree: string;
  /** 脱敏后的远程 URL */
  remoteUrl: string;
  /** 分支名 */
  branch: string;
  /** HEAD 完整 SHA */
  commitSha: string;
  /** HEAD 提交时间 ISO */
  commitAt: string;
}

/**
 * 从环境变量或本机 git 元数据解析远程仓库 URL（不读取业务源码文件）。
 *
 * 优先级：`SYSTEM_RESOURCES_GIT_REMOTE` → 本机仓库 `origin` URL。
 *
 * @returns 远程 URL；无法解析时抛出 ApiError
 * @throws {ApiError} SYSTEM_RESOURCES_GIT_FAILED 未配置且无法读取 origin
 */
export async function resolveGitRemoteUrl(): Promise<string> {
  const fromEnv = process.env.SYSTEM_RESOURCES_GIT_REMOTE?.trim();
  if (fromEnv) return fromEnv;

  const metaRoot = resolveLocalGitMetaRoot();
  if (metaRoot) {
    try {
      const { stdout } = await runGit(['remote', 'get-url', 'origin'], { cwd: metaRoot });
      const url = stdout.trim();
      if (url) return url;
    } catch {
      // fall through
    }
  }
  throw new ApiError(ApiMessageKey.SYSTEM_RESOURCES_GIT_FAILED);
}

/**
 * 解析统计所用分支名。
 *
 * @returns 分支名（默认 main）
 */
export function resolveGitBranch(): string {
  return process.env.SYSTEM_RESOURCES_GIT_BRANCH?.trim() || 'main';
}

/**
 * 解析浅克隆深度。
 *
 * @returns 正整数深度
 */
export function resolveGitDepth(): number {
  const raw = Number(process.env.SYSTEM_RESOURCES_GIT_DEPTH ?? DEFAULT_GIT_DEPTH);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_GIT_DEPTH;
  return Math.min(Math.floor(raw), 500);
}

/**
 * 脱敏远程 URL（去掉 https 内嵌 token / 用户名密码）。
 *
 * @param url - 原始远程地址
 * @returns 可安全展示的地址
 */
export function redactRemoteUrl(url: string): string {
  try {
    if (url.startsWith('git@') || url.startsWith('ssh://')) {
      return url.replace(/:[^/]+@/, ':****@');
    }
    const u = new URL(url);
    if (u.username || u.password) {
      u.username = u.username ? '****' : '';
      u.password = u.password ? '****' : '';
    }
    return u.toString();
  } catch {
    return url.replace(/\/\/([^/@]+)@/g, '//****@');
  }
}

/**
 * 确保临时目录中有远程仓库的浅克隆，并更新到目标分支最新提交。
 *
 * @param _forceRefresh - 预留；实际是否 fetch 由上层内存缓存控制
 * @returns 工作树路径与 HEAD 元信息
 * @throws {ApiError} SYSTEM_RESOURCES_GIT_FAILED 克隆/拉取失败
 */
export async function ensureRemoteGitCheckout(_forceRefresh = false): Promise<RemoteGitCheckout> {
  const remoteUrl = await resolveGitRemoteUrl();
  const branch = resolveGitBranch();
  const depth = resolveGitDepth();
  const workTree = resolveCacheWorkTree(remoteUrl, branch);

  try {
    await prepareWorkTree(workTree, remoteUrl, branch, depth);

    const commitSha = (await runGit(['rev-parse', 'HEAD'], { cwd: workTree })).stdout.trim();
    const commitAtRaw = (
      await runGit(['show', '-s', '--format=%cI', 'HEAD'], { cwd: workTree })
    ).stdout.trim();
    const commitAt = commitAtRaw || new Date().toISOString();

    return {
      workTree,
      remoteUrl: redactRemoteUrl(remoteUrl),
      branch,
      commitSha,
      commitAt,
    };
  } catch (err) {
    console.error('[system-resources] git checkout failed', {
      workTree,
      remoteUrl: redactRemoteUrl(remoteUrl),
      branch,
      err,
    });
    throw new ApiError(ApiMessageKey.SYSTEM_RESOURCES_GIT_FAILED);
  }
}

/**
 * 准备可用的浅克隆工作树：无效缓存先清理，已有仓库则 fetch 更新。
 *
 * @param workTree - 绝对工作树路径
 * @param remoteUrl - 远程 URL
 * @param branch - 分支
 * @param depth - 浅克隆深度
 * @returns Promise，完成后工作树可用
 */
async function prepareWorkTree(
  workTree: string,
  remoteUrl: string,
  branch: string,
  depth: number,
): Promise<void> {
  const gitDir = join(workTree, '.git');
  const hasValidRepo = existsSync(gitDir);

  if (!hasValidRepo) {
    await mkdir(dirname(workTree), { recursive: true });
    if (existsSync(workTree)) {
      await rm(workTree, { recursive: true, force: true });
    }
    await runGit(
      [
        'clone',
        '--depth',
        String(depth),
        '--single-branch',
        '--branch',
        branch,
        remoteUrl,
        workTree,
      ],
      // 目标路径已是绝对路径，cwd 仅作进程启动目录
      { cwd: dirname(workTree) },
    );
    return;
  }

  try {
    await runGit(['remote', 'set-url', 'origin', remoteUrl], { cwd: workTree });
    await runGit(['fetch', '--depth', String(depth), 'origin', branch], { cwd: workTree });
    await runGit(['checkout', '-B', branch, `origin/${branch}`], { cwd: workTree });
    await runGit(['reset', '--hard', `origin/${branch}`], { cwd: workTree });
  } catch (fetchErr) {
    console.warn('[system-resources] fetch failed, recloning', fetchErr);
    await rm(workTree, { recursive: true, force: true });
    await mkdir(dirname(workTree), { recursive: true });
    await runGit(
      [
        'clone',
        '--depth',
        String(depth),
        '--single-branch',
        '--branch',
        branch,
        remoteUrl,
        workTree,
      ],
      { cwd: dirname(workTree) },
    );
  }
}

/** 与「源代码行数」对齐的扩展名（含 ai-service 等扩展包） */
const SOURCE_LINE_EXTS = new Set(['ts', 'tsx', 'js', 'jsx', 'vue', 'py', 'mjs', 'cjs']);

/** 锁文件名（一律不计入变更/规模相关统计） */
const LOCK_FILE_NAMES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'npm-shrinkwrap.json',
  'cargo.lock',
  'poetry.lock',
  'composer.lock',
  'gemfile.lock',
  'go.sum',
]);

/**
 * 判断是否为依赖锁文件（不参与行数/变更统计）。
 *
 * @param filePath - 仓库内相对路径
 * @returns 是否为锁文件
 */
function isLockFilePath(filePath: string): boolean {
  const base = toPosix(filePath).split('/').pop()?.toLowerCase() ?? '';
  return LOCK_FILE_NAMES.has(base);
}

/**
 * 判断路径是否计入源码行数口径（packages 下且扩展名匹配）。
 *
 * @param filePath - 仓库内相对路径（正斜杠）
 * @returns 是否为源码口径文件
 */
function isSourceLinePath(filePath: string): boolean {
  const path = toPosix(filePath);
  if (isLockFilePath(path)) return false;
  if (!path.startsWith('packages/')) return false;
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return SOURCE_LINE_EXTS.has(ext);
}

/**
 * 解析远程浅克隆仓库中的按日提交趋势与按子包 churn。
 *
 * 仅统计源码口径文件；锁文件、md/json 等不进入增删与子包 churn。
 *
 * @param workTree - 克隆工作树路径
 * @returns commitTrends 按日；moduleChurn 按 packages/* 归类
 */
export async function collectGitCommitStats(workTree: string): Promise<{
  commitTrends: SystemResourceCommitDayStat[];
  moduleChurn: SystemResourceModuleChurnStat[];
}> {
  const { stdout } = await runGit(
    [
      'log',
      '--numstat',
      '--pretty=format:COMMIT\t%ad\t%H',
      '--date=short',
      '--no-merges',
    ],
    { cwd: workTree },
  );

  const dayMap = new Map<string, SystemResourceCommitDayStat>();
  const pkgMap = new Map<string, SystemResourceModuleChurnStat>();
  let currentDate: string | null = null;

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line.startsWith('COMMIT\t')) {
      const parts = line.split('\t');
      currentDate = parts[1] ?? null;
      if (!currentDate) continue;
      const day = dayMap.get(currentDate) ?? {
        date: currentDate,
        insertions: 0,
        deletions: 0,
        sourceInsertions: 0,
        sourceDeletions: 0,
        commits: 0,
        totalLines: 0,
      };
      day.commits += 1;
      dayMap.set(currentDate, day);
      continue;
    }

    if (!currentDate) continue;
    // numstat: insertions\tdeletions\tpath  （二进制为 -\t-\tpath）
    const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
    if (!m) continue;
    const filePath = toPosix(m[3] ?? '');
    if (isLockFilePath(filePath) || !isSourceLinePath(filePath)) continue;

    const ins = m[1] === '-' ? 0 : Number(m[1]);
    const del = m[2] === '-' ? 0 : Number(m[2]);

    const day = dayMap.get(currentDate);
    if (day) {
      day.insertions += ins;
      day.deletions += del;
      day.sourceInsertions += ins;
      day.sourceDeletions += del;
    }

    const pkg = classifyPackagePath(filePath);
    const churn = pkgMap.get(pkg) ?? { name: pkg, insertions: 0, deletions: 0 };
    churn.insertions += ins;
    churn.deletions += del;
    pkgMap.set(pkg, churn);
  }

  const commitTrends = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const moduleChurn = [...pkgMap.values()].sort(
    (a, b) => b.insertions + b.deletions - (a.insertions + a.deletions),
  );

  return { commitTrends, moduleChurn };
}

/**
 * 以远程 HEAD 源码总行数为终点，按日「源码净增」回推窗口内每日代码总量。
 *
 * 浅克隆最早提交常把整库计为新增，窗口净增可能远大于 HEAD。
 * 做法：先按日累加源码净增得到相对曲线，再等比缩放到末日 = HEAD。
 * 这样每天都有总量，有新增就会抬高曲线，且末日与「源代码行数」一致。
 *
 * @param trends - 按日增删行（已按日期升序）；`totalLines` 将被覆盖
 * @param headTotalLines - HEAD 源代码总行数（与概览卡片同源）
 * @returns 带 `totalLines` 的新数组；末日等于 headTotalLines
 */
export function attachCumulativeTotalLines(
  trends: SystemResourceCommitDayStat[],
  headTotalLines: number,
): SystemResourceCommitDayStat[] {
  const head = Math.max(0, Math.round(headTotalLines));
  if (trends.length === 0) return trends;

  const nets = trends.map((d) => d.sourceInsertions - d.sourceDeletions);
  const forward: number[] = [];
  let cursor = 0;
  for (const net of nets) {
    cursor += net;
    forward.push(cursor);
  }
  const last = forward[forward.length - 1] ?? 0;

  // 窗口净增为 0：总量视为稳定在 HEAD
  if (last === 0) {
    return trends.map((d) => ({ ...d, totalLines: head }));
  }

  // 净增为负（整体删多）：改为从 HEAD 倒推并限制非负，避免比例缩放失真
  if (last < 0) {
    let running = head;
    const out = [...trends].reverse().map((d) => {
      const point = { ...d, totalLines: Math.max(0, Math.round(running)) };
      running -= d.sourceInsertions - d.sourceDeletions;
      return point;
    });
    return out.reverse();
  }

  return trends.map((d, i) => ({
    ...d,
    totalLines: Math.max(0, Math.round((forward[i]! / last) * head)),
  }));
}

/**
 * 执行 git 子命令。
 *
 * @param args - git 参数列表
 * @param options.cwd - 工作目录
 * @returns stdout/stderr
 */
async function runGit(
  args: string[],
  options: { cwd: string },
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: options.cwd,
    timeout: GIT_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    env: {
      ...process.env,
      // 避免交互式凭据弹窗卡住服务进程
      GIT_TERMINAL_PROMPT: '0',
    },
  });
  return {
    stdout: typeof stdout === 'string' ? stdout : String(stdout),
    stderr: typeof stderr === 'string' ? stderr : String(stderr),
  };
}

/**
 * 解析「仅用于读取 origin URL」的本机 git 元数据根（含 .git），不用于扫代码。
 *
 * @returns 含 .git 的目录；找不到则 null
 */
function resolveLocalGitMetaRoot(): string | null {
  const envRoot = process.env.PROJECT_ROOT?.trim();
  if (envRoot && existsSync(join(envRoot, '.git'))) return resolve(envRoot);

  const fromFile = resolve(__dirname, '../../../../');
  if (existsSync(join(fromFile, '.git'))) return fromFile;

  let dir = process.cwd();
  for (let depth = 0; depth < 8; depth += 1) {
    if (existsSync(join(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * 计算远程克隆缓存目录路径（始终返回绝对路径）。
 *
 * @param remoteUrl - 远程 URL
 * @param branch - 分支
 * @returns 绝对路径
 */
function resolveCacheWorkTree(remoteUrl: string, branch: string): string {
  const configured = process.env.SYSTEM_RESOURCES_GIT_CACHE_DIR?.trim();
  const base = configured
    ? resolve(configured)
    : join(tmpdir(), 'douxing-system-resources-git');
  const key = createHash('sha1').update(`${remoteUrl}::${branch}`).digest('hex').slice(0, 12);
  return join(base, key);
}

/**
 * 将文件路径归类到 monorepo 子包名。
 *
 * @param filePath - 仓库内相对路径（正斜杠）
 * @returns 子包名或 other / docs / root
 */
function classifyPackagePath(filePath: string): string {
  const path = toPosix(filePath);
  const pkgMatch = /^packages\/([^/]+)\//.exec(path);
  if (pkgMatch?.[1]) return pkgMatch[1];
  if (path.startsWith('docs/') || path === 'docs') return 'docs';
  if (path.startsWith('.cursor/')) return 'cursor';
  if (path.startsWith('scripts/')) return 'scripts';
  return 'other';
}

/**
 * 路径分隔符统一为正斜杠。
 *
 * @param p - 任意路径
 * @returns 正斜杠路径
 */
function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}
