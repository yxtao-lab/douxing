/**
 * W0 · 流程编排 NodeSpan：扩展 toolTrace 的标准化观测条目。
 */

/** LLM 调用 token 用量摘要 */
export interface NodeSpanLlmUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/** RAG 命中分数摘要（POI） */
export interface RagScoreSummaryItem {
  id: number;
  score: number;
  name?: string;
}

/** 单节点观测记录（generalize toolTrace） */
export interface NodeSpan {
  /** 节点唯一标识；旧 trace 可能缺失，读取时由 normalize 回填 tool 名 */
  nodeId?: string;
  tool?: string;
  ok: boolean;
  /** 耗时毫秒；旧 trace 仅存 ms 字段 */
  durationMs?: number;
  inputDigest?: string;
  outputDigest?: string;
  ragMatchedIds?: number[];
  ragScoreSummary?: RagScoreSummaryItem[];
  matchedPlaybookIds?: string[];
  llmUsage?: NodeSpanLlmUsage;
  externalApiCalls?: number;
  estimatedCostCny?: number;
  errorCode?: string;
}

/** C7-b：Agent Tool 调用轨迹（写入 plan_sessions.agent_state，兼容旧字段 tool/ms） */
export interface AgentToolTraceEntry extends NodeSpan {
  tool: string;
  /** 与 durationMs 同义，旧 trace 仅存 ms */
  ms: number;
}

export interface BuildNodeSpanInput {
  nodeId: string;
  tool: string;
  ok: boolean;
  ms: number;
  inputDigest?: string;
  outputDigest?: string;
  ragMatchedIds?: number[];
  ragScoreSummary?: RagScoreSummaryItem[];
  matchedPlaybookIds?: string[];
  llmUsage?: NodeSpanLlmUsage;
  externalApiCalls?: number;
  estimatedCostCny?: number;
  errorCode?: string;
}

/**
 * 将任意 JSON 可序列化值压缩为短摘要，供 NodeSpan input/output digest 使用。
 *
 * @param value - 待摘要的对象、数组或原始值
 * @param maxLen - 最大字符长度；超出截断
 * @returns 可读摘要字符串；`undefined`/`null` 返回空串
 */
export function digestWorkflowPayload(value: unknown, maxLen = 120): string {
  if (value == null) return '';
  let text: string;
  if (typeof value === 'string') {
    text = value.trim();
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    text = String(value);
  } else {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  }
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

/**
 * 构造写入 agent_state 的 NodeSpan 条目（同时填充 ms 与 durationMs）。
 *
 * @param input - 节点标识、耗时与可选观测字段
 * @returns 可持久化的 AgentToolTraceEntry
 */
export function buildNodeSpan(input: BuildNodeSpanInput): AgentToolTraceEntry {
  return {
    nodeId: input.nodeId,
    tool: input.tool,
    ok: input.ok,
    ms: input.ms,
    durationMs: input.ms,
    inputDigest: input.inputDigest,
    outputDigest: input.outputDigest,
    ragMatchedIds: input.ragMatchedIds,
    ragScoreSummary: input.ragScoreSummary,
    matchedPlaybookIds: input.matchedPlaybookIds,
    llmUsage: input.llmUsage,
    externalApiCalls: input.externalApiCalls,
    estimatedCostCny: input.estimatedCostCny,
    errorCode: input.errorCode,
  };
}

/**
 * 将持久化 JSON 中的单条 trace 规范化为 AgentToolTraceEntry；无法识别时返回 null。
 *
 * @param raw - 数据库 agent_state.toolTrace 数组元素
 * @returns 规范化条目；缺必填字段时为 null
 */
export function normalizeAgentToolTraceEntry(raw: unknown): AgentToolTraceEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.tool !== 'string') return null;
  if (typeof record.ok !== 'boolean') return null;

  const ms =
    typeof record.ms === 'number'
      ? record.ms
      : typeof record.durationMs === 'number'
        ? record.durationMs
        : null;
  if (ms == null) return null;

  const nodeId =
    typeof record.nodeId === 'string' && record.nodeId.trim()
      ? record.nodeId
      : record.tool;

  const ragMatchedIds = Array.isArray(record.ragMatchedIds)
    ? record.ragMatchedIds.filter((id): id is number => typeof id === 'number')
    : undefined;

  const ragScoreSummary = Array.isArray(record.ragScoreSummary)
    ? record.ragScoreSummary
        .filter(
          (item): item is RagScoreSummaryItem =>
            !!item
            && typeof item === 'object'
            && typeof (item as RagScoreSummaryItem).id === 'number'
            && typeof (item as RagScoreSummaryItem).score === 'number',
        )
        .map((item) => ({
          id: item.id,
          score: item.score,
          name: typeof item.name === 'string' ? item.name : undefined,
        }))
    : undefined;

  const matchedPlaybookIds = Array.isArray(record.matchedPlaybookIds)
    ? record.matchedPlaybookIds.filter((id): id is string => typeof id === 'string')
    : undefined;

  let llmUsage: NodeSpanLlmUsage | undefined;
  if (record.llmUsage && typeof record.llmUsage === 'object') {
    const usage = record.llmUsage as Record<string, unknown>;
    if (
      typeof usage.inputTokens === 'number'
      && typeof usage.outputTokens === 'number'
      && typeof usage.model === 'string'
    ) {
      llmUsage = {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        model: usage.model,
      };
    }
  }

  return {
    nodeId,
    tool: record.tool,
    ok: record.ok,
    ms,
    durationMs: ms,
    inputDigest: typeof record.inputDigest === 'string' ? record.inputDigest : undefined,
    outputDigest: typeof record.outputDigest === 'string' ? record.outputDigest : undefined,
    ragMatchedIds,
    ragScoreSummary,
    matchedPlaybookIds,
    llmUsage,
    externalApiCalls:
      typeof record.externalApiCalls === 'number' ? record.externalApiCalls : undefined,
    estimatedCostCny:
      typeof record.estimatedCostCny === 'number' ? record.estimatedCostCny : undefined,
    errorCode: typeof record.errorCode === 'string' ? record.errorCode : undefined,
  };
}

/**
 * 批量规范化 toolTrace 数组，丢弃无效条目。
 *
 * @param raw - agent_state.toolTrace 原始值
 * @returns 按原顺序排列的有效 NodeSpan 列表
 */
export function normalizeAgentToolTrace(raw: unknown): AgentToolTraceEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeAgentToolTraceEntry(entry))
    .filter((entry): entry is AgentToolTraceEntry => entry != null);
}

/**
 * 在同一次规划 run 内按工具名递增生成 nodeId（如 `retrieve_attractions-1`）。
 */
export class WorkflowNodeSpanRecorder {
  private seqByTool = new Map<string, number>();

  /**
   * @param trace - 可变 trace 数组，push 结果将写入此数组
   */
  constructor(private readonly trace: AgentToolTraceEntry[]) {}

  /**
   * 记录一次节点执行并 append 到 trace。
   *
   * @param input - 除 nodeId 外的 NodeSpan 字段；nodeId 由 recorder 自动生成
   * @returns 写入的 AgentToolTraceEntry
   */
  push(input: Omit<BuildNodeSpanInput, 'nodeId'>): AgentToolTraceEntry {
    const next = (this.seqByTool.get(input.tool) ?? 0) + 1;
    this.seqByTool.set(input.tool, next);
    const entry = buildNodeSpan({ ...input, nodeId: `${input.tool}-${next}` });
    this.trace.push(entry);
    return entry;
  }
}
