#!/usr/bin/env node
/**
 * PC 用户端 dev：Vite 并行启动时 Windows 常吞掉第二个 server.open，
 * 故关闭 Vite 自带 open，改由脚本延迟打开。
 * 全量 `pnpm run dev` 下默认只打开管理端（见 DOUXING_DEV_ALL / DOUXING_OPEN_TARGETS）。
 * 禁用：DOUXING_NO_OPEN=1
 * 自定义地址：DOUXING_PC_OPEN_URL=http://localhost:15176/
 */
import { DEV_PORTS } from './dev-ports.mjs';
import { runViteDevWithBrowserOpen } from './lib/run-vite-dev-open.mjs';

runViteDevWithBrowserOpen({
  tag: 'pc',
  workspace: '@douxing/pc',
  defaultUrl: process.env.DOUXING_PC_OPEN_URL || `http://localhost:${DEV_PORTS.pc}/`,
  openLabel: '正在打开 PC 用户端',
  openDelayMs: 2500,
});
