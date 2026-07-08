import http from './http';
import type { AgentToolJsonSchemaMap, ApiResponse } from '@douxing/shared';

/**
 * 获取 Agent Tool 可编辑入参 JSON Schema（W6 节点属性表单）。
 *
 * @returns Tool 名 → JSON Schema 映射
 */
export async function fetchAgentToolJsonSchemas(): Promise<AgentToolJsonSchemaMap> {
  const res = await http.get<ApiResponse<AgentToolJsonSchemaMap>>('/admin/agent-tool-schemas');
  return res.data.data ?? {};
}
