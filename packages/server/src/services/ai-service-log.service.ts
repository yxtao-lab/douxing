import { closeSync, existsSync, fstatSync, openSync, readSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ApiError, ApiMessageKey } from '@douxing/shared';

/** 日志来源标识 */
export type AiServiceLogSourceId = 'app' | 'pm2-out' | 'pm2-error';

/** 单条日志行 */
export interface AiServiceLogLine {
  lineNo: number;
  text: string;
}

/** 日志来源元信息 */
export interface AiServiceLogSourceInfo {
  id: AiServiceLogSourceId;
  displayPath: string;
  exists: boolean;
  sizeBytes: number;
}

/** 分页查询结果 */
export interface AiServiceLogPageResult {
  source: AiServiceLogSourceId;
  displayPath: string;
  exists: boolean;
  sizeBytes: number;
  total: number;
  page: number;
  pageSize: number;
  items: AiServiceLogLine[];
  sources: AiServiceLogSourceInfo[];
}

const MAX_READ_BYTES = 2 * 1024 * 1024;
const MAX_LINES_SCAN = 20_000;

/**
 * 解析 monorepo 根目录（向上查找 pnpm-workspace.yaml）。
 *
 * @returns 仓库根路径
 */
function resolveRepoRoot(): string {
  const envRoot = process.env.PROJECT_ROOT?.trim();
  if (envRoot) return resolve(envRoot);

  let dir = process.cwd();
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/**
 * 解析各日志来源的绝对路径与展示路径。
 *
 * @param repoRoot - 仓库根目录
 * @returns 来源 id → { abs, display }
 */
function resolveLogSourcePaths(repoRoot: string): Record<
  AiServiceLogSourceId,
  { abs: string; display: string }
> {
  const appLog = join(repoRoot, 'packages/ai-service/logs/ai-service.log');
  const pm2Out = join(repoRoot, 'logs/pm2-ai-out.log');
  const pm2Err = join(repoRoot, 'logs/pm2-ai-error.log');

  const envApp = process.env.AI_SERVICE_LOG_FILE?.trim();
  const envOut = process.env.AI_SERVICE_PM2_OUT_LOG?.trim();
  const envErr = process.env.AI_SERVICE_PM2_ERROR_LOG?.trim();

  return {
    app: {
      abs: envApp ? resolve(envApp) : appLog,
      display: 'packages/ai-service/logs/ai-service.log',
    },
    'pm2-out': {
      abs: envOut ? resolve(envOut) : pm2Out,
      display: 'logs/pm2-ai-out.log',
    },
    'pm2-error': {
      abs: envErr ? resolve(envErr) : pm2Err,
      display: 'logs/pm2-ai-error.log',
    },
  };
}

/**
 * 读取日志文件尾部文本（大文件仅读末尾 MAX_READ_BYTES）。
 *
 * @param filePath - 绝对路径
 * @returns UTF-8 文本
 * @throws {ApiError} 读取失败
 */
function readLogFileTailText(filePath: string): string {
  let fd: number | undefined;
  try {
    fd = openSync(filePath, 'r');
    const { size } = fstatSync(fd);
    const readSize = Math.min(size, MAX_READ_BYTES);
    const offset = Math.max(0, size - readSize);
    const buffer = Buffer.alloc(readSize);
    readSync(fd, buffer, 0, readSize, offset);
    return buffer.toString('utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === 'ENOENT') return '';
    throw new ApiError(ApiMessageKey.AI_SERVICE_LOG_READ_FAILED);
  } finally {
    if (fd != null) closeSync(fd);
  }
}

/**
 * 构建全部来源元信息。
 *
 * @param paths - 来源路径表
 * @returns 来源列表
 */
function buildSourceInfos(
  paths: Record<AiServiceLogSourceId, { abs: string; display: string }>,
): AiServiceLogSourceInfo[] {
  const order: AiServiceLogSourceId[] = ['app', 'pm2-out', 'pm2-error'];
  return order.map((id) => {
    const { abs, display } = paths[id];
    if (!existsSync(abs)) {
      return { id, displayPath: display, exists: false, sizeBytes: 0 };
    }
    const sizeBytes = statSync(abs).size;
    return { id, displayPath: display, exists: true, sizeBytes };
  });
}

/**
 * 分页查询 ai-service 运行日志（文件尾部，最新在前）。
 *
 * @param options - 来源、关键词、分页
 * @returns 日志行与来源元信息
 */
export function listAiServiceLogsPaginated(options: {
  source?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}): AiServiceLogPageResult {
  const repoRoot = resolveRepoRoot();
  const paths = resolveLogSourcePaths(repoRoot);
  const sources = buildSourceInfos(paths);

  const sourceId: AiServiceLogSourceId =
    options.source === 'pm2-out' || options.source === 'pm2-error' || options.source === 'app'
      ? options.source
      : 'app';

  const { abs, display } = paths[sourceId];
  const sourceMeta = sources.find((item) => item.id === sourceId)!;

  if (!sourceMeta.exists) {
    return {
      source: sourceId,
      displayPath: display,
      exists: false,
      sizeBytes: 0,
      total: 0,
      page: options.page,
      pageSize: options.pageSize,
      items: [],
      sources,
    };
  }

  const raw = readLogFileTailText(abs);
  const keyword = options.keyword?.trim().toLowerCase();
  let lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length > MAX_LINES_SCAN) {
    lines = lines.slice(-MAX_LINES_SCAN);
  }
  if (keyword) {
    lines = lines.filter((line) => line.toLowerCase().includes(keyword));
  }

  const reversed = [...lines].reverse();
  const total = reversed.length;
  const page = Math.max(1, options.page);
  const pageSize = Math.min(Math.max(1, options.pageSize), 500);
  const offset = (page - 1) * pageSize;
  const slice = reversed.slice(offset, offset + pageSize);

  return {
    source: sourceId,
    displayPath: display,
    exists: true,
    sizeBytes: sourceMeta.sizeBytes,
    total,
    page,
    pageSize,
    items: slice.map((text, index) => ({
      lineNo: total - offset - index,
      text,
    })),
    sources,
  };
}
