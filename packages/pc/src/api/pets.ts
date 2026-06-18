import type {
  ApiResponse,
  ConfirmPetMemoriesRequest,
  PaginatedResult,
  PetAnalyzeRequest,
  PetAnalyzeResult,
  PetMemoryWallItem,
  TravelPetFloatingContext,
  TravelPetInfo,
} from '@douxing/shared';
import http from './http';

export async function fetchTravelPetMe() {
  const { data } = await http.get<ApiResponse<TravelPetInfo>>('/pets/me');
  return data.data;
}

/** H3-b：与规划 orchestrator 共用 memory 召回 */
export async function fetchTravelPetFloatingContext() {
  const { data } = await http.get<ApiResponse<TravelPetFloatingContext>>('/pets/me/floating-context');
  return data.data;
}

/** H3-c：记忆墙分页 */
export async function fetchPetMemoriesPage(page: number, pageSize: number) {
  const { data } = await http.get<ApiResponse<PaginatedResult<PetMemoryWallItem>>>(
    '/pets/me/memories',
    { params: { page, pageSize } },
  );
  return data.data;
}

/** H3-c：删除记忆 */
export async function deletePetMemory(id: number) {
  const { data } = await http.delete<ApiResponse<{ id: number }>>(`/pets/me/memories/${id}`);
  return data.data;
}

/** H3-c：置顶 / 取消置顶 */
export async function patchPetMemoryPin(id: number, pinned: boolean) {
  const { data } = await http.patch<ApiResponse<PetMemoryWallItem>>(`/pets/me/memories/${id}`, {
    pinned,
  });
  return data.data;
}

/** H3-c：宠物 AI 分析 */
export async function analyzeTravelPet(body: PetAnalyzeRequest) {
  const { data } = await http.post<ApiResponse<PetAnalyzeResult>>('/pets/me/analyze', body);
  return data.data;
}

/** H3-c：确认写入 analyze 建议的记忆 */
export async function confirmPetMemories(body: ConfirmPetMemoriesRequest) {
  const { data } = await http.post<ApiResponse<{ ids: number[] }>>('/pets/me/memories', body);
  return data.data;
}
