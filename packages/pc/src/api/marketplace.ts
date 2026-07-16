import type {
  DemandQuoteSummary,
  DemandSelectQuoteInput,
  PaginatedResult,
  ServiceDemandDetail,
  ServiceDemandHallQuery,
  ServiceDemandInput,
  ServiceDemandSummary,
  ServiceOrderDetail,
  ServiceOrderDisputeSummary,
  ServiceOrderReviewCreateInput,
  ServiceOrderReviewSummary,
  ServiceOrderStatusInput,
  ServiceOrderSummary,
  ServiceProductDetail,
  ServiceProductHallQuery,
  ServiceProductPurchaseInput,
  ServiceProductSummary,
} from '@douxing/shared';
import http from './http';

/**
 * 创建发单草稿。
 *
 * @param body - 需求表单
 * @returns 新建需求详情
 */
export async function createMarketplaceDemand(body: ServiceDemandInput) {
  const { data } = await http.post<{ data: ServiceDemandDetail }>('/marketplace/demands', body);
  return data.data;
}

/**
 * 发布需求单。
 *
 * @param id - 需求 ID
 * @returns 发布后详情
 */
export async function publishMarketplaceDemand(id: number) {
  const { data } = await http.patch<{ data: ServiceDemandDetail }>(`/marketplace/demands/${id}`, {
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
  const { data } = await http.get<{ data: PaginatedResult<ServiceDemandSummary> }>(
    `/marketplace/demands?${query.toString()}`,
  );
  return data.data;
}

/**
 * 我的需求列表。
 *
 * @returns 需求摘要列表
 */
export async function fetchMyMarketplaceDemands() {
  const { data } = await http.get<{ data: { items: ServiceDemandSummary[] } }>('/marketplace/demands/mine');
  return data.data?.items ?? [];
}

/**
 * 需求详情。
 *
 * @param id - 需求 ID
 * @returns 需求详情
 */
export async function fetchMarketplaceDemandDetail(id: number) {
  const { data } = await http.get<{ data: ServiceDemandDetail }>(`/marketplace/demands/${id}`);
  return data.data;
}

/**
 * 需求报价列表。
 *
 * @param demandId - 需求 ID
 * @returns 报价列表
 */
export async function fetchMarketplaceDemandQuotes(demandId: number) {
  const { data } = await http.get<{ data: { items: DemandQuoteSummary[] } }>(
    `/marketplace/demands/${demandId}/quotes`,
  );
  return data.data?.items ?? [];
}

/**
 * 选定报价。
 *
 * @param demandId - 需求 ID
 * @param body - 含 quoteId
 * @returns 服务订单
 */
export async function selectMarketplaceQuote(demandId: number, body: DemandSelectQuoteInput) {
  const { data } = await http.post<{ data: ServiceOrderDetail }>(
    `/marketplace/demands/${demandId}/select-quote`,
    body,
  );
  return data.data;
}

/**
 * 模拟支付确认（PC 无微信收银台，走 `/pay` mock 履约）。
 *
 * @param orderId - 订单 ID
 * @returns 更新后订单
 */
export async function payMockMarketplaceOrder(orderId: number) {
  const { data } = await http.post<{ data: ServiceOrderDetail }>(`/marketplace/orders/${orderId}/pay`);
  return data.data;
}

/**
 * 推进订单状态。
 *
 * @param orderId - 订单 ID
 * @param body - 目标状态
 * @returns 更新后订单
 */
export async function advanceMarketplaceOrderStatus(orderId: number, body: ServiceOrderStatusInput) {
  const { data } = await http.patch<{ data: ServiceOrderDetail }>(`/marketplace/orders/${orderId}/status`, body);
  return data.data;
}

/**
 * 我的服务订单。
 *
 * @returns 订单列表
 */
export async function fetchMyMarketplaceOrders() {
  const { data } = await http.get<{ data: { items: ServiceOrderSummary[] } }>('/marketplace/orders/mine');
  return data.data?.items ?? [];
}

/**
 * 标品大厅分页列表（仅上架）。
 *
 * @param params - 筛选参数
 * @returns 分页结果
 */
export async function fetchMarketplaceProductHall(params: ServiceProductHallQuery = {}) {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  if (params.categoryCode) query.set('categoryCode', params.categoryCode);
  if (params.destination) query.set('destination', params.destination);
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.orgId != null) query.set('orgId', String(params.orgId));
  const { data } = await http.get<{ data: PaginatedResult<ServiceProductSummary> }>(
    `/marketplace/products?${query.toString()}`,
  );
  return data.data;
}

/**
 * 标品详情。
 *
 * @param id - 标品 ID
 * @returns 标品详情
 */
export async function fetchMarketplaceProductDetail(id: number) {
  const { data } = await http.get<{ data: ServiceProductDetail }>(`/marketplace/products/${id}`);
  return data.data;
}

/**
 * 标品直购下单。
 *
 * @param productId - 标品 ID
 * @param body - SKU 与数量
 * @returns 待支付订单
 */
export async function purchaseMarketplaceProduct(productId: number, body: ServiceProductPurchaseInput) {
  const { data } = await http.post<{ data: ServiceOrderDetail }>(
    `/marketplace/products/${productId}/purchase`,
    body,
  );
  return data.data;
}

/**
 * 创建服务订单评价。
 *
 * @param orderId - 订单 ID
 * @param body - 评价内容
 * @returns 新建评价摘要
 */
export async function createMarketplaceOrderReview(
  orderId: number,
  body: ServiceOrderReviewCreateInput,
): Promise<ServiceOrderReviewSummary> {
  const { data } = await http.post<{ data: ServiceOrderReviewSummary }>(
    `/marketplace/orders/${orderId}/reviews`,
    body,
  );
  return data.data;
}

/**
 * 列出服务订单评价。
 *
 * @param orderId - 订单 ID
 * @returns 评价列表
 */
export async function fetchMarketplaceOrderReviews(orderId: number): Promise<ServiceOrderReviewSummary[]> {
  const { data } = await http.get<{ data: { items: ServiceOrderReviewSummary[] } }>(
    `/marketplace/orders/${orderId}/reviews`,
  );
  return data.data?.items ?? [];
}

/**
 * 创建服务订单争议。
 *
 * @param orderId - 订单 ID
 * @param body - 争议类型与原因
 * @returns 新建争议摘要
 */
export async function createMarketplaceOrderDispute(
  orderId: number,
  body: { type: string; reason: string },
): Promise<ServiceOrderDisputeSummary> {
  const { data } = await http.post<{ data: ServiceOrderDisputeSummary }>(
    `/marketplace/orders/${orderId}/disputes`,
    body,
  );
  return data.data;
}

/**
 * 列出服务订单争议。
 *
 * @param orderId - 订单 ID
 * @returns 争议列表
 */
export async function fetchMarketplaceOrderDisputes(orderId: number): Promise<ServiceOrderDisputeSummary[]> {
  const { data } = await http.get<{ data: { items: ServiceOrderDisputeSummary[] } }>(
    `/marketplace/orders/${orderId}/disputes`,
  );
  return data.data?.items ?? [];
}
