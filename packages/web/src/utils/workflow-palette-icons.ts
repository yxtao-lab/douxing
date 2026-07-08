import type { Component } from 'vue';
import {
  AimOutlined,
  ApartmentOutlined,
  BookOutlined,
  BranchesOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CoffeeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DollarOutlined,
  EnvironmentOutlined,
  EyeOutlined,
  HomeOutlined,
  ImportOutlined,
  NodeIndexOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SearchOutlined,
  ShareAltOutlined,
  SlidersOutlined,
  StopOutlined,
  ToolOutlined,
  WalletOutlined,
} from '@ant-design/icons-vue';
import type { WorkflowEditorToolName, WorkflowGraphNodeKind } from '@douxing/shared';

/** 画布节点 ID → 面板图标 ID 别名（如参考图 memory 对应 memory_subgraph） */
const WORKFLOW_GRAPH_NODE_ID_ICON_ALIASES: Record<string, string> = {
  memory: 'memory_subgraph',
};

/** Tool 节点图标映射 */
const WORKFLOW_PALETTE_TOOL_ICONS: Record<WorkflowEditorToolName, Component> = {
  parse_intent: AimOutlined,
  select_workflow_template: ApartmentOutlined,
  retrieve_attractions: EnvironmentOutlined,
  retrieve_playbooks: BookOutlined,
  generate_route_draft: NodeIndexOutlined,
  enrich_route: PlusOutlined,
  validate_route: SafetyCertificateOutlined,
  build_route_variants: CopyOutlined,
  patch_route_day: CalendarOutlined,
  tune_route_budget: WalletOutlined,
  answer_food_qa: CoffeeOutlined,
  select_plan_variant: CheckSquareOutlined,
  recall_user_memory: SearchOutlined,
  apply_memory_context: ImportOutlined,
  write_trip_memory: SaveOutlined,
  replan_segment: ReloadOutlined,
  detect_missed_pois: EyeOutlined,
};

/** 编排 / 起止节点图标映射 */
const WORKFLOW_PALETTE_NODE_ICONS: Record<string, Component> = {
  start: PlayCircleOutlined,
  end: StopOutlined,
  memory_subgraph: DatabaseOutlined,
  transit_subgraph: CarOutlined,
  intent_router: ShareAltOutlined,
  tweak_branch: SlidersOutlined,
  budget_branch: DollarOutlined,
  lodging_branch: HomeOutlined,
  qa_food_branch: QuestionCircleOutlined,
  select_variant_branch: CheckCircleOutlined,
  plan_new_branch: RocketOutlined,
};

/**
 * 解析 Agent Tool 在左侧面板中的图标组件。
 *
 * @param toolName - Tool 名
 * @returns Vue 图标组件；未知 Tool 时返回通用 Tool 图标
 */
export function resolveWorkflowPaletteToolIcon(toolName: string): Component {
  return WORKFLOW_PALETTE_TOOL_ICONS[toolName as WorkflowEditorToolName] ?? ToolOutlined;
}

/**
 * 解析编排节点或 start/end 在左侧面板中的图标组件。
 *
 * @param nodeId - 节点稳定 ID（如 memory_subgraph、start）
 * @returns Vue 图标组件；未知 ID 时返回 BranchesOutlined
 */
export function resolveWorkflowPaletteNodeIcon(nodeId: string): Component {
  return WORKFLOW_PALETTE_NODE_ICONS[nodeId] ?? BranchesOutlined;
}

/**
 * 按面板选中项解析图标。
 *
 * @param payload - toolName 或 nodeId 二选一
 * @returns Vue 图标组件
 */
export function resolveWorkflowPaletteItemIcon(payload: {
  toolName?: string;
  nodeId?: string;
}): Component {
  if (payload.toolName) return resolveWorkflowPaletteToolIcon(payload.toolName);
  if (payload.nodeId) return resolveWorkflowPaletteNodeIcon(payload.nodeId);
  return ToolOutlined;
}

/**
 * 解析画布节点图标（与左侧面板共用映射）。
 *
 * @param params - 节点种类、画布 ID、Tool 名（kind=tool 时）
 * @returns Vue 图标组件
 */
export function resolveWorkflowGraphNodeIcon(params: {
  kind: WorkflowGraphNodeKind;
  nodeId: string;
  toolName?: string;
}): Component {
  if (params.kind === 'tool') {
    if (params.toolName) return resolveWorkflowPaletteToolIcon(params.toolName);
    return resolveWorkflowPaletteToolIcon(params.nodeId);
  }
  if (params.kind === 'start' || params.kind === 'end') {
    return resolveWorkflowPaletteNodeIcon(params.kind);
  }
  const aliasId = WORKFLOW_GRAPH_NODE_ID_ICON_ALIASES[params.nodeId] ?? params.nodeId;
  const byId = WORKFLOW_PALETTE_NODE_ICONS[aliasId];
  if (byId) return byId;
  if (params.kind === 'condition') return ShareAltOutlined;
  if (params.kind === 'subgraph') return DatabaseOutlined;
  if (params.kind === 'branch') return BranchesOutlined;
  return ToolOutlined;
}
