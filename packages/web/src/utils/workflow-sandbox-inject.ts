import type { InjectionKey, Ref } from 'vue';

/** 画布沙箱运行上下文（开始节点 inject） */
export interface WorkflowSandboxInjectContext {
  /** 规划 prompt */
  prompt: Ref<string>;
  /** 是否正在运行 */
  running: Ref<boolean>;
  /**
   * 更新 prompt。
   *
   * @param value - 新 prompt
   */
  setPrompt: (value: string) => void;
  /** 触发沙箱运行 */
  run: () => void;
}

/** provide/inject 键 */
export const WORKFLOW_SANDBOX_INJECT_KEY: InjectionKey<WorkflowSandboxInjectContext> =
  Symbol('workflowSandbox');
