import type {
  AppendPlanMessageRequest,
  CreatePlanSessionRequest,
  PlanSessionActionResult,
  PlanSessionInfo,
  SelectPlanCandidateRequest,
} from '@douxing/shared';
import http from './http';
import type { ApiResponse } from '@douxing/shared';
import { requestAiPlan } from './ai-plan';

export async function fetchPlanSession(sessionId: number) {
  const { data } = await http.get<ApiResponse<PlanSessionInfo>>(
    `/routes/plan-sessions/${sessionId}`,
  );
  return data.data;
}

export async function createPlanSession(body: CreatePlanSessionRequest) {
  return requestAiPlan<PlanSessionActionResult>('/routes/plan-sessions', {
    method: 'POST',
    data: body,
    loadingMessageKey: 'plan.aiPlanningMulti',
  });
}

export async function appendPlanMessage(sessionId: number, body: AppendPlanMessageRequest) {
  return requestAiPlan<PlanSessionActionResult>(`/routes/plan-sessions/${sessionId}/messages`, {
    method: 'POST',
    data: body,
    loadingMessageKey: 'plan.aiPlanningAdjust',
  });
}

export async function selectPlanCandidate(sessionId: number, body: SelectPlanCandidateRequest) {
  const { data } = await http.post<ApiResponse<PlanSessionActionResult>>(
    `/routes/plan-sessions/${sessionId}/select-candidate`,
    body,
  );
  return data.data;
}
