import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type BizOrgDetail,
  type BizOrgReviewInput,
  type BizOrgSummary,
  type PaginatedResult,
} from '@douxing/shared';

export interface MarketplaceOrgListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  orgType?: string;
}

/**
 * 分页获取待审商户列表。
 *
 * @param params - 筛选与分页参数
 * @returns 分页结果
 */
export async function fetchPendingMarketplaceOrgsPage(params: MarketplaceOrgListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.orgType) query.set('orgType', params.orgType);
  const { data } = await http.get<ApiResponse<PaginatedResult<BizOrgSummary>>>(
    `/marketplace/admin/orgs/pending?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
}

/**
 * 分页获取全部商户列表。
 *
 * @param params - 筛选与分页参数
 * @returns 分页结果
 */
export async function fetchMarketplaceOrgsPage(params: MarketplaceOrgListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status) query.set('status', params.status);
  if (params.orgType) query.set('orgType', params.orgType);
  const { data } = await http.get<ApiResponse<PaginatedResult<BizOrgSummary>>>(
    `/marketplace/admin/orgs?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
}

/**
 * 获取商户详情（含资质附件）。
 *
 * @param id - 商户 ID
 * @returns 商户详情
 */
export async function fetchMarketplaceOrgDetail(id: number) {
  const { data } = await http.get<ApiResponse<BizOrgDetail>>(`/marketplace/admin/orgs/${id}`);
  return data.data;
}

/**
 * 审核商户入驻申请。
 *
 * @param id - 商户 ID
 * @param body - 审核动作
 * @returns 更新后的商户详情
 */
export async function reviewMarketplaceOrg(id: number, body: BizOrgReviewInput) {
  const { data } = await http.patch<ApiResponse<BizOrgDetail>>(
    `/marketplace/admin/orgs/${id}/review`,
    body,
  );
  return data.data;
}
