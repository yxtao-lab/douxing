import http from './http';
import type { ApiResponse, SystemResourcesStats } from '@douxing/shared';

/**
 * 获取系统资源统计（代码 / 组件 / 模块 / 文档等）。
 *
 * @param refresh - 是否强制后端重新扫描；默认 false 命中缓存
 * @returns 系统资源统计结果
 */
export async function fetchSystemResourcesStats(refresh = false) {
  const { data } = await http.get<ApiResponse<SystemResourcesStats>>('/analytics/system-resources', {
    params: refresh ? { refresh: 1 } : {},
  });
  return data.data;
}
