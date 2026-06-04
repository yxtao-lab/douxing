import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const DEVTOOLS_DIR_PATTERN = /微信|wechat.*devtools|devtools.*wechat/i;
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'Windows',
  '$Recycle.Bin',
  'System Volume Information',
]);

function isWechatDevtoolsDir(name) {
  return DEVTOOLS_DIR_PATTERN.test(name);
}

function cliFromInstallDir(dir) {
  if (!dir || !existsSync(dir)) return null;
  for (const name of ['cli.bat', 'cli']) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readWindowsRegistryCli() {
  if (process.platform !== 'win32') return null;

  const keys = [
    'HKCU\\Software\\Tencent\\微信web开发者工具',
    'HKCU\\Software\\Tencent\\微信开发者工具',
    'HKLM\\Software\\Tencent\\微信web开发者工具',
    'HKLM\\Software\\WOW6432Node\\Tencent\\微信web开发者工具',
  ];

  for (const key of keys) {
    for (const valueName of ['InstallPath', 'Install Dir', 'Path']) {
      const result = spawnSync('reg', ['query', key, '/v', valueName], { encoding: 'utf8' });
      if (result.status !== 0) continue;
      const match = result.stdout.match(new RegExp(`${valueName}\\s+REG_SZ\\s+(.+)`, 'i'));
      const installDir = match?.[1]?.trim();
      const cli = cliFromInstallDir(installDir);
      if (cli) return cli;
    }
  }

  return null;
}

function readRunningDevtoolsCli() {
  if (process.platform !== 'win32') return null;

  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'wechat|devtools|微信' } | Select-Object -ExpandProperty ExecutablePath",
    ],
    { encoding: 'utf8' },
  );

  const lines = (ps.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const exePath of lines) {
    if (!/wechat|devtools|微信/i.test(exePath)) continue;
    const cli = cliFromInstallDir(dirname(exePath));
    if (cli) return cli;
  }

  return null;
}

function scanDirForCli(rootDir, maxDepth = 4, depth = 0) {
  if (!rootDir || !existsSync(rootDir) || depth > maxDepth) return null;

  const direct = cliFromInstallDir(rootDir);
  if (direct) return direct;

  let entries;
  try {
    entries = readdirSync(rootDir);
  } catch {
    return null;
  }

  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    const fullPath = join(rootDir, name);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;

    if (isWechatDevtoolsDir(name)) {
      const cli = cliFromInstallDir(fullPath);
      if (cli) return cli;
    }

    const shouldDive =
      depth === 0 ||
      /Tencent|Programs|软件|Software|devtools|微信|wechat/i.test(name);

    if (shouldDive) {
      const nested = scanDirForCli(fullPath, maxDepth, depth + 1);
      if (nested) return nested;
    }
  }

  return null;
}

function collectScanRoots() {
  const roots = [];
  const push = (value) => {
    if (value && existsSync(value) && !roots.includes(value)) roots.push(value);
  };

  push(process.env.WECHAT_DEVTOOLS_HOME?.trim());

  if (process.platform === 'win32') {
    push('C:\\Program Files (x86)\\Tencent');
    push('C:\\Program Files\\Tencent');
    push(process.env.LOCALAPPDATA);
    push(process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, 'Programs') : null);
    push(process.env.APPDATA);
    if (process.env.USERPROFILE) {
      push(join(process.env.USERPROFILE, 'Desktop'));
      push(join(process.env.USERPROFILE, 'Downloads'));
    }
    for (const drive of ['D:', 'E:', 'F:']) {
      push(`${drive}\\Program Files\\Tencent`);
      push(`${drive}\\Program Files (x86)\\Tencent`);
      push(`${drive}\\软件`);
      push(`${drive}\\Tools`);
      push(`${drive}\\wechat devtool`);
    }
  } else if (process.platform === 'darwin') {
    push('/Applications/wechatwebdevtools.app/Contents/MacOS');
    push('/Applications/微信开发者工具.app/Contents/MacOS');
  }

  return roots;
}

let cachedCliPath = null;

export function findWechatCli() {
  if (cachedCliPath && existsSync(cachedCliPath)) return cachedCliPath;

  const fromEnv = process.env.WECHAT_DEVTOOLS_CLI?.trim();
  if (fromEnv && existsSync(fromEnv)) {
    cachedCliPath = fromEnv;
    return cachedCliPath;
  }

  const candidates = [
    readWindowsRegistryCli(),
    readRunningDevtoolsCli(),
    ...collectScanRoots().map((root) => scanDirForCli(root)),
    process.platform === 'win32'
      ? 'C:\\Program Files (x86)\\Tencent\\微信web开发者工具\\cli.bat'
      : null,
    process.platform === 'win32'
      ? 'C:\\Program Files\\Tencent\\微信web开发者工具\\cli.bat'
      : null,
    process.platform === 'darwin'
      ? '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'
      : null,
  ].filter(Boolean);

  cachedCliPath = candidates.find((path) => existsSync(path)) ?? null;
  return cachedCliPath;
}

function parseHttpPorts() {
  const raw = process.env.WECHAT_DEVTOOLS_PORT?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((port) => Number.isFinite(port) && port > 0);
}

async function openViaHttp(projectPath) {
  const ports = parseHttpPorts();
  if (ports.length === 0) return false;

  const encoded = encodeURIComponent(projectPath);
  for (const port of ports) {
    const urls = [
      `http://127.0.0.1:${port}/v2/open?project=${encoded}`,
      `http://127.0.0.1:${port}/open?project=${encoded}`,
    ];
    for (const url of urls) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (response.ok) return true;
      } catch {
        // try next endpoint
      }
    }
  }
  return false;
}

function openViaCli(cliPath, projectPath) {
  return new Promise((resolvePromise) => {
    const command =
      process.platform === 'win32'
        ? `"${cliPath}" open --project "${projectPath}"`
        : null;
    const child =
      command != null
        ? spawn(command, { shell: true, stdio: 'inherit' })
        : spawn(cliPath, ['open', '--project', projectPath], { stdio: 'inherit' });

    child.on('error', (err) => {
      console.warn('[mp-weixin] CLI 启动失败:', err.message);
      resolvePromise(false);
    });
    child.on('exit', (code) => resolvePromise(code === 0 || code === null));
  });
}

export async function openWechatProject(projectPath) {
  const absoluteProjectPath = resolve(projectPath);
  if (!existsSync(join(absoluteProjectPath, 'project.config.json'))) {
    return { ok: false, reason: 'project-not-ready' };
  }

  const cli = findWechatCli();
  if (cli) {
    const ok = await openViaCli(cli, absoluteProjectPath);
    if (ok) return { ok: true, method: 'cli', cli };
  }

  const httpOk = await openViaHttp(absoluteProjectPath);
  if (httpOk) return { ok: true, method: 'http' };

  return { ok: false, reason: cli ? 'cli-failed' : 'cli-not-found' };
}

export function printWechatOpenHelp(projectPath) {
  console.warn('[mp-weixin] 未能自动打开微信开发者工具。');
  console.warn('[mp-weixin] 请确认已安装开发者工具，并在「设置 → 安全设置」开启「服务端口」。');
  console.warn(`[mp-weixin] 手动导入目录：${resolve(projectPath)}`);
  console.warn('[mp-weixin] 或在项目根目录 .env 配置：');
  console.warn('[mp-weixin]   WECHAT_DEVTOOLS_CLI=C:/path/to/cli.bat');
  console.warn('[mp-weixin]   WECHAT_DEVTOOLS_PORT=你的服务端口（可选，用于 HTTP 唤起）');
}
