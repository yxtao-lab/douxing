import type {
  DemandQuoteSummary,
  DemandSelectQuoteInput,
  PaginatedResult,
  ServiceDemandDetail,
  ServiceDemandHallQuery,
  ServiceDemandInput,
  ServiceDemandSummary,
  ServiceOrderDetail,
  ServiceOrderStatusInput,
  ServiceOrderSummary,
  ServiceProductDetail,
  ServiceProductHallQuery,
  ServiceProductPurchaseInput,
  ServiceProductSummary,
} from '@douxing/shared';
import { request } from '@/utils/request';

/**
 * 创建发单草稿。
 *
 * @param body - 需求表单
 * @returns 新建需求详情
 */
export function createMarketplaceDemand(body: ServiceDemandInput) {
  return request<ServiceDemandDetail>('/marketplace/demands', { method: 'POST', data: body });
}

/**
 * 发布需求单。
 *
 * @param id - 需求 ID
 * @returns 发布后详情
 */
export function publishMarketplaceDemand(id: number) {
  return request<ServiceDemandDetail>(`/marketplace/demands/${id}`, {
    method: 'PATCH',
    data: { action: 'publish' },
  });
}

/**
 * 需求大厅分页列表。
 *
 * @param params - 筛选参数
 * @returns 分页结果
 */
export function fetchMarketplaceHallPage(params: ServiceDemandHallQuery) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.categoryCode) query.set('categoryCode', params.categoryCode);
  if (params.destination) query.set('destination', params.destination);
  if (params.keyword) query.set('keyword', params.keyword);
  return request<PaginatedResult<ServiceDemandSummary>>(`/marketplace/demands?${query.toString()}`);
}

/**
 * 我的需求列表。
 *
 * @returns 需求摘要列表
 */
export function fetchMyMarketplaceDemands() {
  return request<{ items: ServiceDemandSummary[] }>('/marketplace/demands/mine').then((r) => r.items ?? []);
}

/**
 * 需求详情。
 *
 * @param id - 需求 ID
 * @returns 需求详情
 */
export function fetchMarketplaceDemandDetail(id: number) {
  return request<ServiceDemandDetail>(`/marketplace/demands/${id}`);
}

/**
 * 需求报价列表。
 *
 * @param demandId - 需求 ID
 * @returns 报价列表
 */
export function fetchMarketplaceDemandQuotes(demandId: number) {
  return request<{ items: DemandQuoteSummary[] }>(`/marketplace/demands/${demandId}/quotes`).then(
    (r) => r.items ?? [],
  );
}

/**
 * 选定报价。
 *
 * @param demandId - 需求 ID
 * @param body - 含 quoteId
 * @returns 服务订单
 */
export function selectMarketplaceQuote(demandId: number, body: DemandSelectQuoteInput) {
  return request<ServiceOrderDetail>(`/marketplace/demands/${demandId}/select-quote`, {
    method: 'POST',
    data: body,
  });
}

/**
 * 模拟支付。
 *
 * @param orderId - 订单 ID
 * @returns 更新后订单
 */
export function payMockMarketplaceOrder(orderId: number) {
  return request<ServiceOrderDetail>(`/marketplace/orders/${orderId}/pay-mock`, { method: 'POST' });
}

/**
 * 推进订单状态。
 *
 * @param orderId - 订单 ID
 * @param body - 目标状态
 * @returns 更新后订单
 */
export function advanceMarketplaceOrderStatus(orderId: number, body: ServiceOrderStatusInput) {
  return request<ServiceOrderDetail>(`/marketplace/orders/${orderId}/status`, {
    method: 'PATCH',
    data: body,
  });
}

/**
 * 我的服务订单。
 *
 * @returns 订单列表
 */
export function fetchMyMarketplaceOrders() {
  return request<{ items: ServiceOrderSummary[] }>('/marketplace/orders/mine').then((r) => r.items ?? []);
}

/**
 * 标品大厅分页列表（仅上架）。
 *
 * @param params - 筛选参数
 * @returns 分页结果
 */
export function fetchMarketplaceProductHall(params: ServiceProductHallQuery = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.categoryCode) query.set('categoryCode', params.categoryCode);
  if (params.destination) query.set('destination', params.destination);
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.orgId != null) query.set('orgId', String(params.orgId));
  return request<PaginatedResult<ServiceProductSummary>>(`/marketplace/products?${query.toString()}`);
}

/**
 * 标品详情。
 *
 * @param id - 标品 ID
 * @returns 标品详情
 */
export function fetchMarketplaceProductDetail(id: number) {
  return request<ServiceProductDetail>(`/marketplace/products/${id}`);
}

/**
 * 标品直购下单。
 *
 * @param productId - 标品 ID
 * @param body - SKU 与数量
 * @returns 待支付订单
 */
export function purchaseMarketplaceProduct(productId: number, body: ServiceProductPurchaseInput) {
  return request<ServiceOrderDetail>(`/marketplace/products/${productId}/purchase`, {
    method: 'POST',
    data: body,
  });
}
