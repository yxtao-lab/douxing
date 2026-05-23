import type {
  AppendPlanMessageRequest,
  CreatePlanSessionRequest,
  PlanSessionActionResult,
  PlanSessionInfo,
  PlanSessionSummary,
  SelectPlanCandidateRequest,
} from '@douxing/shared';
import { request, requestAiPlan } from '@/utils/request';

export function fetchPlanSessions(limit = 20) {
  return request<PlanSessionSummary[]>(`/routes/plan-sessions?limit=${limit}`);
}

export function fetchPlanSession(sessionId: number) {
  return request<PlanSessionInfo>(`/routes/plan-sessions/${sessionId}`);
}

export function createPlanSession(data: CreatePlanSessionRequest) {
  return requestAiPlan<PlanSessionActionResult>('/routes/plan-sessions', {
    method: 'POST',
    data,
    loadingMessage: 'AI 正在生成多套方案…',
  });
}

export function appendPlanMessage(sessionId: number, data: AppendPlanMessageRequest) {
  return requestAiPlan<PlanSessionActionResult>(`/routes/plan-sessions/${sessionId}/messages`, {
    method: 'POST',
    data,
    loadingMessage: 'AI 正在调整方案…',
  });
}

export function selectPlanCandidate(sessionId: number, data: SelectPlanCandidateRequest) {
  return request<PlanSessionActionResult>(`/routes/plan-sessions/${sessionId}/select-candidate`, {
    method: 'POST',
    data,
  });
}
