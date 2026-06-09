/**
 * Vite dev 就绪后自动打开浏览器（concurrently 下比 Vite server.open 更可靠）
 */
import http from 'node:http';
import { spawn, exec } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pmFilterCmd } from '../pm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** 后台启动子进程，不阻塞 dev 主流程 */
function spawnDetached(command, args) {
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return child;
}

function openBrowserUrl(url, title = 'Douxing') {
  if (process.env.DOUXING_NO_OPEN === '1') return;

  if (process.platform === 'win32') {
    // 必须显式调 cmd.exe；不同 title 避免连续 start 被 Windows 合并成一次
    try {
      spawnDetached('cmd.exe', ['/c', 'start', title, url]);
      return;
    } catch {
      // 继续尝试备用方案
    }
    try {
      spawnDetached('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
      return;
    } catch {
      // 继续尝试备用方案
    }
    spawnDetached('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process ${JSON.stringify(url)}`,
    ]);
    return;
  }

  if (process.platform === 'darwin') {
    exec(`open ${JSON.stringify(url)}`);
    return;
  }
  exec(`xdg-open ${JSON.stringify(url)}`);
}

/** 探测 dev server 是否已可访问 */
function probeUrlReachable(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.get(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname || '/',
          timeout: timeoutMs,
        },
        (res) => {
          res.resume();
          resolve(true);
        },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

/** 从 Vite 输出中解析实际 Local 地址（端口被占用时会变化） */
function parseLocalUrl(text) {
  const match = text.match(/Local:\s+(https?:\/\/(?:localhost|127\.0\.0\.1):\d+\/?)/i);
  if (!match?.[1]) return null;
  return match[1].endsWith('/') ? match[1] : `${match[1]}/`;
}

/**
 * @param {{
 *   tag: string;
 *   workspace: string;
 *   defaultUrl: string;
 *   openLabel: string;
 *   openDelayMs?: number;
 * }} options
 */
export function runViteDevWithBrowserOpen(options) {
  const { tag, workspace, defaultUrl, openLabel } = options;
  // Web 与 PC 同时就绪时，Windows 连续 start 常只打开第一个标签页
  const openDelayMs = options.openDelayMs ?? (tag === 'pc' ? 1500 : 0);

  let opened = false;
  let detectedUrl = defaultUrl.trim();
  let sawReady = false;
  const startedAt = Date.now();

  function openBrowser() {
    if (opened || process.env.DOUXING_NO_OPEN === '1') return;
    opened = true;
    const url = detectedUrl;
    setTimeout(() => {
      console.log(`[${tag}] ${openLabel} ${url}`);
      openBrowserUrl(url, tag === 'pc' ? 'Douxing PC' : 'Douxing Web');
    }, openDelayMs);
  }

  function noteViteOutput(text) {
    const parsed = parseLocalUrl(text);
    if (parsed) {
      detectedUrl = parsed;
      sawReady = true;
      return;
    }
    if (/ready in \d+\s*ms/i.test(text) || /dev server running at:/i.test(text)) {
      sawReady = true;
    }
  }

  async function pollUntilReady() {
    const deadline = Date.now() + 120_000;
    // 等 Vite 子进程拉起，避免误探到其它占用默认端口的进程
    await new Promise((r) => setTimeout(r, 1000));

    while (Date.now() < deadline && !opened) {
      const canOpen = sawReady || Date.now() - startedAt > 15_000;

      if (canOpen && (await probeUrlReachable(detectedUrl))) {
        openBrowser();
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // HTTP 探活 + 日志解析双保险
  void pollUntilReady();

  const child = spawn(pmFilterCmd(workspace, 'dev'), {
    cwd: root,
    // inherit 避免 Windows 下 pnpm 管道丢日志导致无法检测就绪
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      DOUXING_VITE_NO_OPEN: '1',
    },
  });

  function attachStream(stream, label) {
    if (!stream) return;
    stream.on('data', (chunk) => {
      const text = chunk.toString();
      process[label].write(chunk);
      if (!opened) noteViteOutput(text);
    });
  }

  attachStream(child.stdout, 'stdout');
  attachStream(child.stderr, 'stderr');

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
