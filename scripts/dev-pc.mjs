#!/usr/bin/env node
/**
 * PC 用户端 dev：就绪后自动打开浏览器
 * 禁用：DOUXING_NO_OPEN=1
 * 自定义地址：DOUXING_PC_OPEN_URL=http://localhost:5176/
 */
import { runViteDevWithBrowserOpen } from './lib/run-vite-dev-open.mjs';

runViteDevWithBrowserOpen({
  tag: 'pc',
  workspace: '@douxing/pc',
  defaultUrl: process.env.DOUXING_PC_OPEN_URL || 'http://localhost:5176/',
  openLabel: '正在打开 PC 用户端',
});
