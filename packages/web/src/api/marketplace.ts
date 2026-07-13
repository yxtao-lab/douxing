import http from './http';
import {
  normalizePaginatedResult,
  type ApiResponse,
  type BizOrgReviewInput,
  type BizOrgSummary,
  type DemandQuoteSummary,
  type DemandSelectQuoteInput,
  type PaginatedResult,
  type ServiceDemandDetail,
  type ServiceDemandHallQuery,
  type ServiceDemandInput,
  type ServiceDemandSummary,
  type ServiceOrderDetail,
  type ServiceOrderStatusInput,
  type ServiceOrderSummary,
} from '@douxing/shared';

export interface MarketplaceDemandListParams {
  page: number;
  pageSize: number;
  keyword?: string;
  status?: string;
  categoryCode?: string;
  destination?: string;
}

/**
 * 分页获取需求单监管列表。
 *
 * @param params - 筛选与分页参数
 * @returns 分页结果
 */
export async function fetchMarketplaceDemandsPage(params: MarketplaceDemandListParams) {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.status) query.set('status', params.status);
  if (params.categoryCode) query.set('categoryCode', params.categoryCode);
  if (params.destination) query.set('destination', params.destination);
  const { data } = await http.get<ApiResponse<PaginatedResult<ServiceDemandSummary>>>(
    `/marketplace/admin/demands?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page,
    pageSize: params.pageSize,
  });
}

/**
 * 分页获取待审商户列表。
 *
 * @param params - 筛选与分页参数
 * @returns 分页结果
 */
export async function fetchPendingMarketplaceOrgsPage(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  orgType?: string;
}) {
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
 * 审核商户入驻申请。
 *
 * @param orgId - 商户 ID
 * @param body - 审核动作与备注
 * @returns 更新后的商户摘要
 */
export async function reviewMarketplaceOrg(orgId: number, body: BizOrgReviewInput) {
  const { data } = await http.patch<ApiResponse<BizOrgSummary>>(
    `/marketplace/admin/orgs/${orgId}/review`,
    body,
  );
  return data.data;
}

/**
 * 创建发单草稿。
 *
 * @param body - 需求表单
 * @returns 新建需求详情
 */
export async function createMarketplaceDemand(body: ServiceDemandInput) {
  const { data } = await http.post<ApiResponse<ServiceDemandDetail>>('/marketplace/demands', body);
  return data.data;
}

/**
 * 更新发单草稿。
 *
 * @param id - 需求 ID
 * @param body - 更新字段
 * @returns 更新后详情
 */
export async function updateMarketplaceDemand(id: number, body: ServiceDemandInput) {
  const { data } = await http.patch<ApiResponse<ServiceDemandDetail>>(`/marketplace/demands/${id}`, body);
  return data.data;
}

/**
 * 发布需求单。
 *
 * @param id - 需求 ID
 * @returns 发布后详情
 */
export async function publishMarketplaceDemand(id: number) {
  const { data } = await http.patch<ApiResponse<ServiceDemandDetail>>(`/marketplace/demands/${id}`, {
    action: 'publish',
  });
  return data.data;
}

/**
 * 需求大厅分页列表。
 *
 * @param params - 筛选参数
 * @returns 分页结果
 */
export async function fetchMarketplaceHallPage(params: ServiceDemandHallQuery) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.categoryCode) query.set('categoryCode', params.categoryCode);
  if (params.destination) query.set('destination', params.destination);
  if (params.keyword) query.set('keyword', params.keyword);
  const { data } = await http.get<ApiResponse<PaginatedResult<ServiceDemandSummary>>>(
    `/marketplace/demands?${query.toString()}`,
  );
  return normalizePaginatedResult(data.data, {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  });
}

/**
 * 我的需求列表。
 *
 * @returns 需求摘要列表
 */
export async function fetchMyMarketplaceDemands() {
  const { data } = await http.get<ApiResponse<{ items: ServiceDemandSummary[] }>>('/marketplace/demands/mine');
  return data.data?.items ?? [];
}

/**
 * 需求详情。
 *
 * @param id - 需求 ID
 * @returns 需求详情
 */
export async function fetchMarketplaceDemandDetail(id: number) {
  const { data } = await http.get<ApiResponse<ServiceDemandDetail>>(`/marketplace/demands/${id}`);
  return data.data;
}

/**
 * 需求报价列表（发单方）。
 *
 * @param demandId - 需求 ID
 * @returns 报价列表
 */
export async function fetchMarketplaceDemandQuotes(demandId: number) {
  const { data } = await http.get<ApiResponse<{ items: DemandQuoteSummary[] }>>(
    `/marketplace/demands/${demandId}/quotes`,
  );
  return data.data?.items ?? [];
}

/**
 * 提交报价。
 *
 * @param demandId - 需求 ID
 * @param body - 报价表单
 * @returns 新建报价
 */
export async function submitMarketplaceQuote(
  demandId: number,
  body: { amount: string; proposalText?: string; orgId?: number },
) {
  const { data } = await http.post<ApiResponse<DemandQuoteSummary>>(
    `/marketplace/demands/${demandId}/quotes`,
    body,
  );
  return data.data;
}

/**
 * 选定报价并生成订单。
 *
 * @param demandId - 需求 ID
 * @param body - 含 quoteId
 * @returns 服务订单
 */
export async function selectMarketplaceQuote(demandId: number, body: DemandSelectQuoteInput) {
  const { data } = await http.post<ApiResponse<ServiceOrderDetail>>(
    `/marketplace/demands/${demandId}/select-quote`,
    body,
  );
  return data.data;
}

/**
 * 模拟支付服务订单。
 *
 * @param orderId - 订单 ID
 * @returns 更新后订单
 */
export async function payMockMarketplaceOrder(orderId: number) {
  const { data } = await http.post<ApiResponse<ServiceOrderDetail>>(
    `/marketplace/orders/${orderId}/pay-mock`,
  );
  return data.data;
}

/**
 * 推进服务订单状态。
 *
 * @param orderId - 订单 ID
 * @param body - 目标状态
 * @returns 更新后订单
 */
export async function advanceMarketplaceOrderStatus(orderId: number, body: ServiceOrderStatusInput) {
  const { data } = await http.patch<ApiResponse<ServiceOrderDetail>>(
    `/marketplace/orders/${orderId}/status`,
    body,
  );
  return data.data;
}

/**
 * 我的服务订单列表。
 *
 * @returns 订单摘要列表
 */
export async function fetchMyMarketplaceOrders() {
  const { data } = await http.get<ApiResponse<{ items: ServiceOrderSummary[] }>>('/marketplace/orders/mine');
  return data.data?.items ?? [];
}
