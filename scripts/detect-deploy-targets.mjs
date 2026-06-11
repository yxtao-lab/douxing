#!/usr/bin/env node
/**
 * 根据 Push 变更文件推断发版目标（server / pc / web）
 *
 * 环境变量:
 *   WEBHOOK_BEFORE / WEBHOOK_AFTER  Gitee push 的 commit sha
 *   WEBHOOK_CHANGED_FILES             可选，JSON 数组或逗号分隔路径（Webhook 预解析）
 *   WEBHOOK_COMMIT_MESSAGES           可选，JSON 数组，支持 [deploy:web] [deploy:all]
 *   WEBHOOK_DEPLOY_MODE               auto | full（默认 auto）
 *   WEBHOOK_DEPLOY_ALLOW              允许自动发的包，默认 server,pc,web
 *   WEBHOOK_DEPLOY_DEFAULT            无法识别时 fallback，默认与 ALLOW 相同
 *
 * 输出: 逗号分隔 target（stdout）；无需发版时无输出且 exit 0
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const EMPTY_SHA = /^0+$/;

/** @type {Record<string, string[]>} */
const PATH_TARGETS = {
  'packages/server/': ['server'],
  'packages/pc/': ['pc'],
  'packages/web/': ['web'],
  'packages/shared/': ['server', 'pc', 'web'],
  'packages/ai-service/': ['server'],
};

/** 变更这些路径 → 发全部允许的目标 */
const GLOBAL_PREFIXES = [
  'pnpm-lock.yaml',
  'package.json',
  'pnpm-workspace.yaml',
  'deploy/',
  'scripts/deploy',
  'scripts/pm.mjs',
  'scripts/ci-build',
  'scripts/gitee-webhook',
  'scripts/detect-deploy-targets.mjs',
  '.env.example',
  'deploy/env.production.example',
];

function parseList(raw, fallback) {
  if (!raw?.trim()) return fallback;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseChangedFilesEnv() {
  const raw = process.env.WEBHOOK_CHANGED_FILES?.trim();
  if (!raw) return null;
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      return null;
    }
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

function parseCommitMessages() {
  const raw = process.env.WEBHOOK_COMMIT_MESSAGES?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [raw];
  } catch {
    return [raw];
  }
}

function targetsFromCommitMessages(messages, allowSet) {
  const targets = new Set();
  for (const message of messages) {
    const match = message.match(/\[deploy:([^\]]+)\]/i);
    if (!match) continue;
    const token = match[1].trim().toLowerCase();
    if (token === 'all' || token === '*') {
      for (const item of allowSet) targets.add(item);
      continue;
    }
    for (const part of token.split(/[,+\s|]+/)) {
      const key = part.trim();
      if (key && allowSet.has(key)) targets.add(key);
    }
  }
  return targets;
}

function gitDiffNames(before, after) {
  if (!before || !after || before === after) return [];
  if (EMPTY_SHA.test(before) || EMPTY_SHA.test(after)) return null;
  try {
    const out = execSync(`git diff --name-only ${before} ${after}`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return null;
  }
}

function gitShowChangedFiles(before, after) {
  const fromEnv = parseChangedFilesEnv();
  if (fromEnv?.length) return fromEnv;

  const diff = gitDiffNames(before, after);
  if (diff !== null) return diff;

  try {
    const out = execSync('git diff --name-only HEAD~1 HEAD', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return out.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isGlobalChange(file) {
  return GLOBAL_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix));
}

/**
 * @param {string[]} files
 * @param {Set<string>} allowSet
 */
function targetsFromFiles(files, allowSet) {
  if (files.some(isGlobalChange)) {
    return [...allowSet].sort();
  }

  const targets = new Set();
  for (const file of files) {
    if (file.startsWith('packages/mobile/')) {
      continue;
    }
    if (file.startsWith('docs/') || file.startsWith('.github/') || file.startsWith('.workflow/')) {
      continue;
    }
    for (const [prefix, list] of Object.entries(PATH_TARGETS)) {
      if (file.startsWith(prefix)) {
        for (const target of list) {
          if (allowSet.has(target)) targets.add(target);
        }
      }
    }
  }
  return [...targets].sort();
}

function main() {
  const mode = (process.env.WEBHOOK_DEPLOY_MODE || 'auto').trim().toLowerCase();
  const allow = parseList(process.env.WEBHOOK_DEPLOY_ALLOW, ['server', 'pc', 'web']);
  const allowSet = new Set(allow);
  const fallback = parseList(process.env.WEBHOOK_DEPLOY_DEFAULT, allow);

  if (mode === 'full') {
    process.stdout.write(allow.join(','));
    return;
  }

  if (mode === 'off') {
    return;
  }

  const messages = parseCommitMessages();
  const msgTargets = targetsFromCommitMessages(messages, allowSet);
  if (msgTargets.size > 0) {
    process.stdout.write([...msgTargets].sort().join(','));
    return;
  }

  const before = process.env.WEBHOOK_BEFORE?.trim() || '';
  const after = process.env.WEBHOOK_AFTER?.trim() || '';
  const files = gitShowChangedFiles(before, after);

  if (files === null || EMPTY_SHA.test(before)) {
    process.stdout.write(fallback.join(','));
    return;
  }

  if (files.length === 0) {
    return;
  }

  const targets = targetsFromFiles(files, allowSet);
  if (targets.length === 0) {
    console.error('[detect-deploy-targets] 变更文件无需发版:', files.slice(0, 20).join(', '));
    return;
  }

  process.stdout.write(targets.join(','));
}

main();
