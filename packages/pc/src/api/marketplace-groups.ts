import type {
  DemandGroupDetail,
  DemandGroupInput,
  GroupMemberSummary,
  GroupMembershipSummary,
  InviteGroupMemberInput,
} from '@douxing/shared';
import http from './http';

/**
 * 创建发单团体。
 *
 * @param body - 团体表单
 * @returns 新建团体详情（含成员）
 */
export async function createMarketplaceGroup(body: DemandGroupInput) {
  const { data } = await http.post<{ data: DemandGroupDetail }>('/marketplace/groups', body);
  return data.data;
}

/**
 * 当前用户所属团体列表。
 *
 * @returns 成员关系摘要列表
 */
export async function fetchMyMarketplaceGroups() {
  const { data } = await http.get<{ data: { items: GroupMembershipSummary[] } }>(
    '/marketplace/groups/mine',
  );
  return data.data?.items ?? [];
}

/**
 * 团体详情（须为成员）。
 *
 * @param id - 团体 ID
 * @returns 团体详情
 */
export async function fetchMarketplaceGroupDetail(id: number) {
  const { data } = await http.get<{ data: DemandGroupDetail }>(`/marketplace/groups/${id}`);
  return data.data;
}

/**
 * 更新团体（仅 owner）。
 *
 * @param id - 团体 ID
 * @param body - 更新字段
 * @returns 更新后详情
 */
export async function updateMarketplaceGroup(id: number, body: DemandGroupInput) {
  const { data } = await http.patch<{ data: DemandGroupDetail }>(`/marketplace/groups/${id}`, body);
  return data.data;
}

/**
 * 删除团体（仅 owner）。
 *
 * @param id - 团体 ID
 */
export async function deleteMarketplaceGroup(id: number) {
  await http.delete(`/marketplace/groups/${id}`);
}

/**
 * 邀请协作者（仅 owner）。
 *
 * @param groupId - 团体 ID
 * @param body - 含目标 userId
 * @returns 新成员摘要
 */
export async function inviteMarketplaceGroupMember(groupId: number, body: InviteGroupMemberInput) {
  const { data } = await http.post<{ data: GroupMemberSummary }>(
    `/marketplace/groups/${groupId}/members`,
    body,
  );
  return data.data;
}

/**
 * 移除协作者（仅 owner）。
 *
 * @param groupId - 团体 ID
 * @param userId - 被移除用户 ID
 */
export async function removeMarketplaceGroupMember(groupId: number, userId: number) {
  await http.delete(`/marketplace/groups/${groupId}/members/${userId}`);
}
