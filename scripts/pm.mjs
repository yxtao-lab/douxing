#!/usr/bin/env node
/**
 * 统一包管理器：自动识别 pnpm / npm，供根脚本与部署脚本调用。
 * 优先 pnpm（与 packageManager、pnpm-lock.yaml 一致）；无 pnpm 时回退 npm workspaces。
 *
 * 环境变量 DOUXING_PM=pnpm|npm 可强制指定。
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(__dirname, '..');

let cachedPm = null;

function commandExists(cmd) {
  try {
    const check =
      process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(check, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/** @returns {'pnpm' | 'npm'} */
export function detectPm() {
  if (cachedPm) return cachedPm;

  const forced = process.env.DOUXING_PM?.trim().toLowerCase();
  if (forced === 'pnpm' || forced === 'npm') {
    cachedPm = forced;
    return cachedPm;
  }

  const ua = process.env.npm_config_user_agent ?? '';
  if (/pnpm/i.test(ua)) {
    cachedPm = 'pnpm';
    return cachedPm;
  }
  if (/^npm\//i.test(ua)) {
    cachedPm = 'npm';
    return cachedPm;
  }

  const execPath = process.env.npm_execpath ?? '';
  if (execPath.includes('pnpm')) {
    cachedPm = 'pnpm';
    return cachedPm;
  }
  if (execPath.includes('npm')) {
    cachedPm = 'npm';
    return cachedPm;
  }

  const hasPnpmLock = existsSync(resolve(projectRoot, 'pnpm-lock.yaml'));
  const hasNpmLock = existsSync(resolve(projectRoot, 'package-lock.json'));

  if (hasNpmLock && !hasPnpmLock) {
    cachedPm = 'npm';
    return cachedPm;
  }
  if (hasPnpmLock && commandExists('pnpm')) {
    cachedPm = 'pnpm';
    return cachedPm;
  }
  if (commandExists('pnpm')) {
    cachedPm = 'pnpm';
    return cachedPm;
  }

  cachedPm = 'npm';
  return cachedPm;
}

export function getRunHint(script) {
  const pm = detectPm();
  if (script === 'install') {
    return pm === 'pnpm' ? 'pnpm install' : 'npm install';
  }
  return pm === 'pnpm' ? `pnpm ${script}` : `npm run ${script}`;
}

export function pmInstallCmd(opts = {}) {
  const pm = detectPm();
  const includeDev = opts.includeDev !== false;
  if (pm === 'pnpm') {
    let cmd = opts.frozen ? 'pnpm install --frozen-lockfile' : 'pnpm install';
    if (includeDev && process.env.NODE_ENV === 'production') {
      cmd += ' --prod=false';
    }
    return cmd;
  }
  if (opts.frozen && existsSync(resolve(projectRoot, 'package-lock.json'))) {
    if (includeDev && process.env.NODE_ENV === 'production') {
      return 'npm ci --include=dev';
    }
    return 'npm ci';
  }
  if (includeDev && process.env.NODE_ENV === 'production') {
    return 'npm install --include=dev';
  }
  return 'npm install';
}

export function pmFilterCmd(workspace, script, extraArgs = []) {
  const pm = detectPm();
  const extra = extraArgs.length ? ` ${extraArgs.map(shellQuote).join(' ')}` : '';
  if (pm === 'pnpm') {
    return `pnpm --filter ${workspace} ${script}${extra}`;
  }
  return `npm run ${script} -w ${workspace}${extra}`;
}

export function pmFilterExecCmd(workspace, bin, args = []) {
  const pm = detectPm();
  const tail = [bin, ...args].map(shellQuote).join(' ');
  if (pm === 'pnpm') {
    return `pnpm --filter ${workspace} exec ${tail}`;
  }
  return `npm exec -w ${workspace} -- ${tail}`;
}

export function pmRecursiveCmd(script) {
  const pm = detectPm();
  if (pm === 'pnpm') return `pnpm run -r ${script}`;
  // 必须排除根 workspace：根 package.json 的 build 会再调 pm.mjs recursive，否则死循环
  return `npm run ${script} --workspaces --if-present --no-include-workspace-root`;
}

export function pmExecCmd(args = []) {
  const pm = detectPm();
  const tail = args.map(shellQuote).join(' ');
  if (pm === 'pnpm') return `pnpm exec ${tail}`;
  return `npm exec ${tail}`;
}

export function pmRunCmd(script, args = []) {
  const pm = detectPm();
  const tail = args.length ? ` ${args.map(shellQuote).join(' ')}` : '';
  if (pm === 'pnpm') return `pnpm ${script}${tail}`;
  return `npm run ${script}${tail}`;
}

/** 在当前工作目录执行包内脚本（用于子包 package.json 链式 build） */
export function pmLocalRunCmd(script) {
  const pm = detectPm();
  return pm === 'pnpm' ? `pnpm run ${script}` : `npm run ${script}`;
}

export function pmSpawnDev(script = 'dev') {
  const pm = detectPm();
  if (pm === 'pnpm') {
    return spawn('pnpm', [script], { cwd: projectRoot, stdio: 'inherit', shell: true });
  }
  return spawn('npm', ['run', script], { cwd: projectRoot, stdio: 'inherit', shell: true });
}

function shellQuote(arg) {
  const s = String(arg);
  if (/[\s"'\\]/.test(s)) return `"${s.replace(/"/g, '\\"')}"`;
  return s;
}

function runInRoot(cmd) {
  console.log(`[pm:${detectPm()}] > ${cmd}`);
  execSync(cmd, { cwd: projectRoot, stdio: 'inherit' });
}

const isMain =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMain) {
  const [sub, ...rest] = process.argv.slice(2);
  try {
    switch (sub) {
      case 'install':
        runInRoot(pmInstallCmd({ frozen: rest.includes('--frozen-lockfile') }));
        break;
      case 'filter': {
        const [workspace, script, ...extra] = rest;
        if (!workspace || !script) {
          console.error('用法: node scripts/pm.mjs filter <workspace> <script> [args...]');
          process.exit(1);
        }
        runInRoot(pmFilterCmd(workspace, script, extra));
        break;
      }
      case 'filter-exec': {
        const [workspace, bin, ...args] = rest;
        if (!workspace || !bin) {
          console.error('用法: node scripts/pm.mjs filter-exec <workspace> <bin> [args...]');
          process.exit(1);
        }
        runInRoot(pmFilterExecCmd(workspace, bin, args));
        break;
      }
      case 'recursive':
        runInRoot(pmRecursiveCmd(rest[0] ?? 'build'));
        break;
      case 'exec':
        runInRoot(pmExecCmd(rest));
        break;
      case 'run':
        runInRoot(pmRunCmd(rest[0], rest.slice(1)));
        break;
      default:
        console.error(
          '用法: node scripts/pm.mjs <install|filter|filter-exec|recursive|exec|run> ...',
        );
        process.exit(1);
    }
  } catch (err) {
    console.error('[pm] 失败:', err.message ?? err);
    process.exit(1);
  }
}
