import type {
  ConfirmPetMemoriesRequest,
  PaginatedResult,
  PetAnalyzeRequest,
  PetAnalyzeResult,
  PetMemoryWallItem,
  TravelPetFloatingContext,
  TravelPetInfo,
} from '@douxing/shared';
import { request } from '@/utils/request';

export function fetchTravelPetMe() {
  return request<TravelPetInfo>('/pets/me');
}

/** H3-b：与规划 orchestrator 共用 memory 召回 */
export function fetchTravelPetFloatingContext() {
  return request<TravelPetFloatingContext>('/pets/me/floating-context');
}

/** H3-c：记忆墙分页 */
export function fetchPetMemoriesPage(page: number, pageSize: number) {
  return request<PaginatedResult<PetMemoryWallItem>>(
    `/pets/me/memories?page=${page}&pageSize=${pageSize}`,
  );
}

/** H3-c：删除记忆 */
export function deletePetMemory(id: number) {
  return request<{ id: number }>(`/pets/me/memories/${id}`, { method: 'DELETE' });
}

/** H3-c：置顶 / 取消置顶 */
export function patchPetMemoryPin(id: number, pinned: boolean) {
  return request<PetMemoryWallItem>(`/pets/me/memories/${id}`, {
    method: 'PATCH',
    data: { pinned },
  });
}

/** H3-c：宠物 AI 分析 */
export function analyzeTravelPet(body: PetAnalyzeRequest) {
  return request<PetAnalyzeResult>('/pets/me/analyze', { method: 'POST', data: body });
}

/** H3-c：确认写入 analyze 建议的记忆 */
export function confirmPetMemories(body: ConfirmPetMemoriesRequest) {
  return request<{ ids: number[] }>('/pets/me/memories', { method: 'POST', data: body });
}
