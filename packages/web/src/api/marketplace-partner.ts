import http from './http';
import type {
  BizOrgApplyInput,
  BizOrgDetail,
  DemandQuoteCreateInput,
  MarketplacePartnerContext,
  OrgMemberListItem,
  OrgMembershipSummary,
  OrgSettlementSummary,
  PartnerQuoteListItem,
  ServiceDemandDetail,
  ServiceDemandHallQuery,
  ServiceOrderAssignInput,
  ServiceOrderDetail,
  ServiceOrderReportCreateInput,
  ServiceOrderReportSummary,
  ServiceOrderStatusInput,
  ServiceProviderApplyInput,
  ServiceProviderSummary,
} from '@douxing/shared';
import { type ApiResponse } from '@douxing/shared';
import { fetchMarketplaceHallPage, submitMarketplaceQuote } from './marketplace';

/**
 * 开通商户管理端访问（绑定 merchant 角色）。
 *
 * @returns 接口成功时无返回值
 */
export async function enrollMerchantAdminAccess(): Promise<void> {
  await http.post('/marketplace/partner/enroll');
}

/** 资质文件上传结果 */
export interface MarketplaceDocumentUploadResult {
  fileUrl: string;
  publicUrl: string;
  fileName: string;
}

/**
 * 读取商户工作台上下文。
 *
 * @returns 入驻状态与可报价身份
 */
export async function fetchPartnerContext() {
  const { data } = await http.get<ApiResponse<MarketplacePartnerContext>>('/marketplace/partner/context');
  return data.data;
}

/**
 * 上传商户入驻资质文件。
 *
 * @param file - 本地文件
 * @returns 存储路径与对外 URL
 */
export async function uploadMarketplaceDocument(file: File): Promise<MarketplaceDocumentUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post<{ data: MarketplaceDocumentUploadResult }>(
    '/marketplace/orgs/documents/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
}

/**
 * 提交商户入驻申请。
 *
 * @param body - 入驻表单
 * @returns 新建商户详情
 */
export async function applyMarketplaceOrg(body: BizOrgApplyInput) {
  const { data } = await http.post<ApiResponse<BizOrgDetail>>('/marketplace/orgs/apply', body);
  return data.data;
}

/**
 * 查询当前用户的商户成员关系。
 *
 * @returns 成员关系列表
 */
export async function fetchMyOrgMemberships() {
  const { data } = await http.get<ApiResponse<{ items: OrgMembershipSummary[] }>>('/marketplace/orgs/mine');
  return data.data?.items ?? [];
}

/**
 * 提交个人服务者认证。
 *
 * @param body - 认证表单
 * @returns 服务者摘要
 */
export async function applyMarketplaceProvider(body: ServiceProviderApplyInput) {
  const { data } = await http.post<ApiResponse<ServiceProviderSummary>>('/marketplace/providers/apply', body);
  return data.data;
}

/**
 * 查询当前用户的服务者认证记录。
 *
 * @returns 服务者摘要；未申请时为 null
 */
export async function fetchMyServiceProvider() {
  const { data } = await http.get<ApiResponse<{ provider: ServiceProviderSummary | null }>>('/marketplace/providers/me');
  return data.data?.provider ?? null;
}

/**
 * 接单大厅分页列表。
 *
 * @param params - 筛选参数
 * @returns 分页结果
 */
export async function fetchPartnerDemandHallPage(params: ServiceDemandHallQuery) {
  return fetchMarketplaceHallPage(params);
}

/**
 * 需求详情（服务方浏览）。
 *
 * @param id - 需求 ID
 * @returns 需求详情
 */
export async function fetchPartnerDemandDetail(id: number) {
  const { data } = await http.get<ApiResponse<ServiceDemandDetail>>(`/marketplace/demands/${id}`);
  return data.data;
}

/**
 * 提交报价。
 *
 * @param demandId - 需求 ID
 * @param body - 报价表单
 * @returns 新建报价
 */
export async function submitPartnerQuote(demandId: number, body: DemandQuoteCreateInput) {
  return submitMarketplaceQuote(demandId, body);
}

/**
 * 我的报价列表。
 *
 * @returns 报价列表（含需求摘要）
 */
export async function fetchMyPartnerQuotes() {
  const { data } = await http.get<ApiResponse<{ items: PartnerQuoteListItem[] }>>('/marketplace/quotes/mine');
  return data.data?.items ?? [];
}

/**
 * 卖方服务订单列表。
 *
 * @returns 订单详情列表
 */
export async function fetchSellerMarketplaceOrders() {
  const { data } = await http.get<ApiResponse<{ items: ServiceOrderDetail[] }>>('/marketplace/orders/seller');
  return data.data?.items ?? [];
}

/**
 * 服务订单详情。
 *
 * @param orderId - 订单 ID
 * @returns 订单详情
 */
export async function fetchMarketplaceOrderDetail(orderId: number) {
  const { data } = await http.get<ApiResponse<ServiceOrderDetail>>(`/marketplace/orders/${orderId}`);
  return data.data;
}

/**
 * 推进服务订单履约状态。
 *
 * @param orderId - 订单 ID
 * @param body - 目标状态
 * @returns 更新后订单
 */
export async function advanceSellerMarketplaceOrder(orderId: number, body: ServiceOrderStatusInput) {
  const { data } = await http.patch<ApiResponse<ServiceOrderDetail>>(`/marketplace/orders/${orderId}/status`, body);
  return data.data;
}

/**
 * 商户结算台账列表（仅当前用户为该商户 owner/admin 时可查）。
 *
 * @param params - `orgId` 必填；`status` 可选状态过滤
 * @returns 结算摘要列表；无记录时为空数组
 */
export async function fetchPartnerSettlements(params: {
  orgId: number;
  status?: string;
}): Promise<OrgSettlementSummary[]> {
  const { data } = await http.get<ApiResponse<{ items: OrgSettlementSummary[] }>>(
    '/marketplace/partner/settlements',
    { params },
  );
  return data.data?.items ?? [];
}

/**
 * 列出商户成员（指派领队候选）。
 *
 * @param orgId - 商户 ID
 * @returns 成员列表；空数组表示无成员
 */
export async function fetchOrgMembers(orgId: number): Promise<OrgMemberListItem[]> {
  const { data } = await http.get<ApiResponse<{ items: OrgMemberListItem[] }>>(
    `/marketplace/orgs/${orgId}/members`,
  );
  return data.data?.items ?? [];
}

/**
 * 指派或清除服务订单履约领队。
 *
 * @param orderId - 订单 ID
 * @param body - `guideUserId` 为 null 时清除指派
 * @returns 更新后的订单详情
 */
export async function assignMarketplaceOrderGuide(
  orderId: number,
  body: ServiceOrderAssignInput,
): Promise<ServiceOrderDetail> {
  const { data } = await http.patch<ApiResponse<ServiceOrderDetail>>(
    `/marketplace/orders/${orderId}/assign`,
    body,
  );
  return data.data;
}

/**
 * 列出订单履约汇报时间线。
 *
 * @param orderId - 订单 ID
 * @returns 按时间升序的汇报列表；无记录为空数组
 */
export async function fetchMarketplaceOrderReports(
  orderId: number,
): Promise<ServiceOrderReportSummary[]> {
  const { data } = await http.get<ApiResponse<{ items: ServiceOrderReportSummary[] }>>(
    `/marketplace/orders/${orderId}/reports`,
  );
  return data.data?.items ?? [];
}

/**
 * 提交履约汇报（签到或图文）。
 *
 * @param orderId - 订单 ID
 * @param body - 汇报表单
 * @returns 新建汇报摘要
 */
export async function createMarketplaceOrderReport(
  orderId: number,
  body: ServiceOrderReportCreateInput,
): Promise<ServiceOrderReportSummary> {
  const { data } = await http.post<ApiResponse<ServiceOrderReportSummary>>(
    `/marketplace/orders/${orderId}/reports`,
    body,
  );
  return data.data;
}

/**
 * 上传履约汇报图片。
 *
 * @param orderId - 订单 ID（用于权限校验）
 * @param file - 本地图片文件
 * @returns 存储路径与对外 URL
 */
export async function uploadMarketplaceOrderReportPhoto(
  orderId: number,
  file: File,
): Promise<{ fileUrl: string; publicUrl: string; fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await http.post<{
    data: { fileUrl: string; publicUrl: string; fileName: string };
  }>(`/marketplace/orders/${orderId}/reports/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}
