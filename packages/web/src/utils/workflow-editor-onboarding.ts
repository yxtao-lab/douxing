/** localStorage 键前缀：记录某模板是否已展示过编排引导 */
const WORKFLOW_EDITOR_ONBOARDING_PREFIX = 'douxing:workflow-editor-onboarding:';

/**
 * 生成模板编排引导的 localStorage 键。
 *
 * @param templateId - 工作流模板 ID
 * @returns 存储键
 */
export function getWorkflowEditorOnboardingStorageKey(templateId: string): string {
  return `${WORKFLOW_EDITOR_ONBOARDING_PREFIX}${templateId}`;
}

/**
 * 是否应展示首次进入编排器的操作引导。
 *
 * @param templateId - 模板 ID
 * @param onboardingQuery - 路由 query.onboarding 值
 * @returns 为 true 时启动 Tour
 */
export function shouldShowWorkflowEditorOnboarding(
  templateId: string,
  onboardingQuery: unknown,
): boolean {
  if (onboardingQuery !== '1' && onboardingQuery !== 'true') return false;
  if (!templateId) return false;
  try {
    return localStorage.getItem(getWorkflowEditorOnboardingStorageKey(templateId)) !== '1';
  } catch {
    return true;
  }
}

/**
 * 标记某模板的编排引导已完成。
 *
 * @param templateId - 模板 ID
 * @returns void
 */
export function markWorkflowEditorOnboardingComplete(templateId: string): void {
  if (!templateId) return;
  try {
    localStorage.setItem(getWorkflowEditorOnboardingStorageKey(templateId), '1');
  } catch {
    // 隐私模式等场景下忽略
  }
}
