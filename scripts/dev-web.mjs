#!/usr/bin/env node
/**
 * Web 管理端 dev：就绪后由脚本打开浏览器（concurrently 下比 Vite server.open 可靠）
 * 禁用：DOUXING_NO_OPEN=1
 * 自定义地址：DOUXING_WEB_OPEN_URL=http://localhost:15173/
 */
import { DEV_PORTS } from './dev-ports.mjs';
import { runViteDevWithBrowserOpen } from './lib/run-vite-dev-open.mjs';

runViteDevWithBrowserOpen({
  tag: 'web',
  workspace: '@douxing/web',
  defaultUrl: process.env.DOUXING_WEB_OPEN_URL || `http://localhost:${DEV_PORTS.web}/`,
  openLabel: '正在打开 Web 管理端',
  openDelayMs: 800,
});
