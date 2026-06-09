#!/usr/bin/env node
/**
 * Web 管理端 dev：就绪后自动打开浏览器
 * 禁用：DOUXING_NO_OPEN=1
 * 自定义地址：DOUXING_WEB_OPEN_URL=http://localhost:5173/
 */
import { runViteDevWithBrowserOpen } from './lib/run-vite-dev-open.mjs';

runViteDevWithBrowserOpen({
  tag: 'web',
  workspace: '@douxing/web',
  defaultUrl: process.env.DOUXING_WEB_OPEN_URL || 'http://localhost:5173/',
  openLabel: '正在打开管理后台',
});
