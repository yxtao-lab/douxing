import type {
  DemandGroupDetail,
  DemandGroupInput,
  GroupMemberSummary,
  GroupMembershipSummary,
  InviteGroupMemberInput,
} from '@douxing/shared';
import { request } from '@/utils/request';

/**
 * 创建发单团体。
 *
 * @param body - 团体表单
 * @returns 新建团体详情（含成员）
 */
export function createMarketplaceGroup(body: DemandGroupInput) {
  return request<DemandGroupDetail>('/marketplace/groups', { method: 'POST', data: body });
}

/**
 * 当前用户所属团体列表。
 *
 * @returns 成员关系摘要列表
 */
export function fetchMyMarketplaceGroups() {
  return request<{ items: GroupMembershipSummary[] }>('/marketplace/groups/mine').then(
    (r) => r.items ?? [],
  );
}

/**
 * 团体详情（须为成员）。
 *
 * @param id - 团体 ID
 * @returns 团体详情
 */
export function fetchMarketplaceGroupDetail(id: number) {
  return request<DemandGroupDetail>(`/marketplace/groups/${id}`);
}

/**
 * 更新团体（仅 owner）。
 *
 * @param id - 团体 ID
 * @param body - 更新字段
 * @returns 更新后详情
 */
export function updateMarketplaceGroup(id: number, body: DemandGroupInput) {
  return request<DemandGroupDetail>(`/marketplace/groups/${id}`, { method: 'PATCH', data: body });
}

/**
 * 删除团体（仅 owner）。
 *
 * @param id - 团体 ID
 */
export function deleteMarketplaceGroup(id: number) {
  return request<null>(`/marketplace/groups/${id}`, { method: 'DELETE' });
}

/**
 * 邀请协作者（仅 owner）。
 *
 * @param groupId - 团体 ID
 * @param body - 含目标 userId
 * @returns 新成员摘要
 */
export function inviteMarketplaceGroupMember(groupId: number, body: InviteGroupMemberInput) {
  return request<GroupMemberSummary>(`/marketplace/groups/${groupId}/members`, {
    method: 'POST',
    data: body,
  });
}

/**
 * 移除协作者（仅 owner）。
 *
 * @param groupId - 团体 ID
 * @param userId - 被移除用户 ID
 */
export function removeMarketplaceGroupMember(groupId: number, userId: number) {
  return request<null>(`/marketplace/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
}
