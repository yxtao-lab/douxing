import http from './http';
import type { ApiResponse, PaginatedResult, WorkflowTemplateInfo } from '@douxing/shared';

export interface WorkflowTemplateListQuery {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export interface WorkflowTemplateUpsertPayload {
  id: string;
  nameZh: string;
  nameEn: string;
  descriptionZh?: string | null;
  descriptionEn?: string | null;
  enabled?: boolean;
  priority?: number;
  selectionRules: Record<string, unknown> | boolean;
  nodeConfig: WorkflowTemplateInfo['nodeConfig'];
  abVariantBId?: string | null;
  abSplitPercent?: number;
  sortOrder?: number;
}

/**
 * 分页获取工作流模板列表。
 *
 * @param query - 分页与 enabled 筛选
 * @returns 分页结果
 */
export async function fetchWorkflowTemplates(query: WorkflowTemplateListQuery = {}) {
  const { data } = await http.get<ApiResponse<PaginatedResult<WorkflowTemplateInfo>>>(
    '/admin/workflow-templates',
    { params: query },
  );
  return data.data;
}

/**
 * 更新工作流模板。
 *
 * @param id - 模板 ID
 * @param payload - 部分字段
 * @returns 更新后的模板
 */
export async function updateWorkflowTemplate(
  id: string,
  payload: Partial<Omit<WorkflowTemplateUpsertPayload, 'id'>>,
) {
  const { data } = await http.put<ApiResponse<WorkflowTemplateInfo>>(
    `/admin/workflow-templates/${id}`,
    payload,
  );
  return data.data;
}
