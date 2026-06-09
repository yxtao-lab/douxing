/**
 * Vite dev 就绪后自动打开浏览器（concurrently 下比 Vite server.open 更可靠）
 */
import { spawn, exec } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pmFilterCmd } from '../pm.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function openBrowserUrl(url) {
  if (process.env.DOUXING_NO_OPEN === '1') return;
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, { shell: true });
    return;
  }
  if (process.platform === 'darwin') {
    exec(`open "${url}"`);
    return;
  }
  exec(`xdg-open "${url}"`);
}

/**
 * @param {{
 *   tag: string;
 *   workspace: string;
 *   defaultUrl: string;
 *   openLabel: string;
 * }} options
 */
export function runViteDevWithBrowserOpen(options) {
  const { tag, workspace, defaultUrl, openLabel } = options;

  let opened = false;
  let detectedUrl = defaultUrl.trim();

  function openBrowser() {
    if (opened || process.env.DOUXING_NO_OPEN === '1') return;
    opened = true;
    console.log(`[${tag}] ${openLabel} ${detectedUrl}`);
    openBrowserUrl(detectedUrl);
  }

  function attachBuildWatcher(stream, label) {
    if (!stream) return;
    let tail = '';
    stream.on('data', (chunk) => {
      const text = chunk.toString();
      process[label].write(chunk);
      if (opened) return;
      tail = (tail + text).slice(-4096);

      const localMatch = tail.match(/Local:\s+(http:\/\/localhost:\d+\/?)/i);
      if (localMatch?.[1]) {
        detectedUrl = localMatch[1].endsWith('/') ? localMatch[1] : `${localMatch[1]}/`;
      }

      if (localMatch || /ready in \d+ms/i.test(tail)) {
        setTimeout(openBrowser, 500);
      }
    });
  }

  const child = spawn(pmFilterCmd(workspace, 'dev'), {
    cwd: root,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: {
      ...process.env,
      DOUXING_VITE_NO_OPEN: '1',
    },
  });

  attachBuildWatcher(child.stdout, 'stdout');
  attachBuildWatcher(child.stderr, 'stderr');

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}
