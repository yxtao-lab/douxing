import http from './http';
import type {
  ApiResponse,
  PaginatedResult,
  WorkflowGraphDefinition,
  WorkflowGraphValidationResult,
  WorkflowTemplateInfo,
} from '@douxing/shared';

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
  graphDef?: WorkflowTemplateInfo['graphDef'];
  graphPublishStatus?: WorkflowTemplateInfo['graphPublishStatus'];
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
 * 获取单个工作流模板详情。
 *
 * @param id - 模板 ID
 * @returns 模板详情
 */
export async function fetchWorkflowTemplateById(id: string) {
  const { data } = await http.get<ApiResponse<WorkflowTemplateInfo>>(
    `/admin/workflow-templates/${id}`,
  );
  return data.data;
}

/**
 * 获取 plan_default 参考 DAG。
 *
 * @returns 默认图定义
 */
export async function fetchDefaultWorkflowGraph() {
  const { data } = await http.get<ApiResponse<WorkflowGraphDefinition>>(
    '/admin/workflow-templates/default-graph',
  );
  return data.data;
}

/**
 * 校验 DAG 图（不落库）。
 *
 * @param graphDef - 待校验图
 * @returns 校验结果
 */
export async function validateWorkflowGraphApi(graphDef: WorkflowGraphDefinition) {
  const { data } = await http.post<ApiResponse<WorkflowGraphValidationResult>>(
    '/admin/workflow-templates/validate-graph',
    { graphDef },
  );
  return data.data;
}

/**
 * 创建工作流模板。
 *
 * @param payload - 完整模板字段
 * @returns 新建模板
 */
export async function createWorkflowTemplate(payload: WorkflowTemplateUpsertPayload) {
  const { data } = await http.post<ApiResponse<WorkflowTemplateInfo>>(
    '/admin/workflow-templates',
    payload,
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

/**
 * W5-5 · 发布工作流图。
 *
 * @param id - 模板 ID
 * @returns 发布后的模板
 */
export async function publishWorkflowTemplateGraph(id: string) {
  const { data } = await http.post<ApiResponse<WorkflowTemplateInfo>>(
    `/admin/workflow-templates/${id}/publish-graph`,
  );
  return data.data;
}
