import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/admin.middleware.js';
import { success, fail, failFromError } from '../utils/response.js';
import {
  ApiError,
  ApiMessageKey,
  WORKFLOW_GRAPH_SCHEMA_VERSION,
  buildDefaultPlanDefaultGraph,
  type WorkflowGraphDefinition,
} from '@douxing/shared';
import { parsePaginationQuery } from '../utils/pagination.js';
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplateById,
  listWorkflowTemplatesForAdmin,
  publishWorkflowTemplateGraph,
  updateWorkflowTemplate,
  validateWorkflowTemplateGraph,
} from '../services/workflow-template.service.js';

const router = Router();
const TemplatePerm = 'data:analytics:view';

const nodeConfigSchema = z.object({
  topK: z.number().int().positive().max(30).optional(),
  variantCount: z.number().int().positive().max(5).optional(),
  mmrLambda: z.number().min(0).max(1).optional(),
  playbookLimit: z.number().int().positive().max(10).optional(),
  skipVariants: z.boolean().optional(),
});

/** W5 · DAG 图 JSON 校验 schema */
const workflowGraphDefSchema = z.custom<WorkflowGraphDefinition>((value) => {
  if (!value || typeof value !== 'object') return false;
  const graph = value as WorkflowGraphDefinition;
  return (
    graph.schemaVersion === WORKFLOW_GRAPH_SCHEMA_VERSION &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.edges)
  );
});

const templateBodySchema = z.object({
  id: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'id must be lowercase slug'),
  nameZh: z.string().min(1).max(128),
  nameEn: z.string().min(1).max(128),
  descriptionZh: z.string().max(2000).optional().nullable(),
  descriptionEn: z.string().max(2000).optional().nullable(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(999).optional(),
  selectionRules: z.union([z.record(z.unknown()), z.boolean()]),
  nodeConfig: nodeConfigSchema,
  abVariantBId: z.string().max(64).nullable().optional(),
  abSplitPercent: z.number().int().min(0).max(99).optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  graphDef: workflowGraphDefSchema.nullable().optional(),
  graphPublishStatus: z.enum(['draft', 'published']).optional(),
});

const templateUpdateSchema = templateBodySchema
  .omit({ id: true })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'empty update' });

router.use(authMiddleware);

const graphBodySchema = z.object({
  graphDef: workflowGraphDefSchema,
});

/**
 * W5 · 获取 plan_default 参考图（与 LangGraph 主图等价）。
 * GET /api/admin/workflow-templates/default-graph
 */
router.get('/default-graph', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;
    success(res, buildDefaultPlanDefaultGraph());
  } catch (err) {
    console.error('[admin/workflow-templates/default-graph]', err);
    fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_DETAIL_FAILED);
  }
});

/**
 * W5-3 · 校验 DAG 图（不落库）。
 * POST /api/admin/workflow-templates/validate-graph
 */
router.post('/validate-graph', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const parsed = graphBodySchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const result = validateWorkflowTemplateGraph(parsed.data.graphDef);
    success(res, result);
  } catch (err) {
    console.error('[admin/workflow-templates/validate-graph]', err);
    fail(res, ApiMessageKey.WORKFLOW_GRAPH_VALIDATION_FAILED);
  }
});

/**
 * W3-5 · 工作流模板分页列表。
 * GET /api/admin/workflow-templates
 */
router.get('/', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const pagination = parsePaginationQuery(req.query);
    const enabledRaw = req.query.enabled;
    const enabled =
      enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : undefined;

    const result = await listWorkflowTemplatesForAdmin({
      page: pagination.page,
      pageSize: pagination.pageSize,
      enabled,
    });
    success(res, result);
  } catch (err) {
    console.error('[admin/workflow-templates/list]', err);
    fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_LIST_FAILED);
  }
});

/**
 * W3-5 · 工作流模板详情。
 * GET /api/admin/workflow-templates/:id
 */
router.get('/:id', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const item = await getWorkflowTemplateById(req.params.id);
    if (!item) {
      fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_NOT_FOUND, 1, 404);
      return;
    }
    success(res, item);
  } catch (err) {
    console.error('[admin/workflow-templates/detail]', err);
    fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_DETAIL_FAILED);
  }
});

/**
 * W3-5 · 新建工作流模板。
 * POST /api/admin/workflow-templates
 */
router.post('/', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const parsed = templateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const staffId = req.auth?.userId;
    const created = await createWorkflowTemplate(parsed.data);
    console.info('[admin/workflow-templates/create]', { staffId, templateId: created.id });
    success(res, created);
  } catch (err) {
    console.error('[admin/workflow-templates/create]', err);
    if (err instanceof ApiError) {
      failFromError(res, err, ApiMessageKey.WORKFLOW_TEMPLATE_CREATE_FAILED);
      return;
    }
    fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_CREATE_FAILED);
  }
});

/**
 * W3-5 · 更新工作流模板（版本 +1，写审计日志）。
 * PUT /api/admin/workflow-templates/:id
 */
router.put('/:id', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const parsed = templateUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      fail(res, ApiMessageKey.PARAM_ERROR);
      return;
    }

    const staffId = req.auth?.userId;
    const updated = await updateWorkflowTemplate(req.params.id, parsed.data);
    console.info('[admin/workflow-templates/update]', {
      staffId,
      templateId: updated.id,
      version: updated.version,
    });
    success(res, updated);
  } catch (err) {
    console.error('[admin/workflow-templates/update]', err);
    if (err instanceof ApiError) {
      failFromError(res, err, ApiMessageKey.WORKFLOW_TEMPLATE_UPDATE_FAILED);
      return;
    }
    fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_UPDATE_FAILED);
  }
});

/**
 * W5-5 · 发布工作流图（校验通过后 status → published）。
 * POST /api/admin/workflow-templates/:id/publish-graph
 */
router.post('/:id/publish-graph', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const staffId = req.auth?.userId;
    const updated = await publishWorkflowTemplateGraph(req.params.id);
    console.info('[admin/workflow-templates/publish-graph]', {
      staffId,
      templateId: updated.id,
      version: updated.version,
      graphPublishStatus: updated.graphPublishStatus,
    });
    success(res, updated);
  } catch (err) {
    console.error('[admin/workflow-templates/publish-graph]', err);
    if (err instanceof ApiError) {
      failFromError(res, err, ApiMessageKey.WORKFLOW_GRAPH_PUBLISH_FAILED);
      return;
    }
    fail(res, ApiMessageKey.WORKFLOW_GRAPH_PUBLISH_FAILED);
  }
});

/**
 * W3-5 · 删除工作流模板。
 * DELETE /api/admin/workflow-templates/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    if (!(await requirePerm(req, res, TemplatePerm))) return;

    const staffId = req.auth?.userId;
    await deleteWorkflowTemplate(req.params.id);
    console.info('[admin/workflow-templates/delete]', { staffId, templateId: req.params.id });
    success(res, { ok: true });
  } catch (err) {
    console.error('[admin/workflow-templates/delete]', err);
    if (err instanceof ApiError) {
      failFromError(res, err, ApiMessageKey.WORKFLOW_TEMPLATE_DELETE_FAILED);
      return;
    }
    fail(res, ApiMessageKey.WORKFLOW_TEMPLATE_DELETE_FAILED);
  }
});

export default router;
