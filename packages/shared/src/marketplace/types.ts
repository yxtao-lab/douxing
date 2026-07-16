import type {
  BizOrgStatusValue,
  BizOrgTypeValue,
  BudgetTypeValue,
  CertStatusValue,
  DemandGroupTypeValue,
  DemandStatusValue,
  GroupMemberRoleValue,
  InvoiceTitleTypeValue,
  MarketplaceNotificationRefTypeValue,
  MarketplaceNotificationTypeValue,
  OrgDocumentTypeValue,
  OrgRoleValue,
  ProductStatusValue,
  ProviderTypeValue,
  PublisherTypeValue,
  QuoteSortReasonValue,
  QuoteStatusValue,
  ServiceCategoryNode,
  ServiceOrderDisputeStatusValue,
  ServiceOrderDisputeTypeValue,
  ServiceOrderReportTypeValue,
  ServiceOrderRevieweeTypeValue,
  ServiceOrderReviewTargetTypeValue,
  ServiceOrderStatusValue,
  SettlementStatusValue,
} from './constants.js';

/** 商户组织结算配置（JSON 快照） */
export interface BizOrgSettlementConfig {
  platformFeeRate?: number;
  settlementCycleDays?: number;
  bankAccountHint?: string;
}

/**
 * 需求单发票抬头信息（存 JSON；本阶段仅存资料，不做真开票）。
 */
export interface DemandInvoiceInfo {
  /** 抬头类型：个人 / 企业 */
  titleType: InvoiceTitleTypeValue;
  /** 发票抬头名称 */
  title: string;
  /** 纳税人识别号；企业抬头建议填写 */
  taxNo?: string;
  /** 注册地址（可选） */
  address?: string;
  /** 联系电话（可选） */
  phone?: string;
  /** 开户银行（可选） */
  bankName?: string;
  /** 银行账号（可选） */
  bankAccount?: string;
}

/** 商户资质附件摘要 */
export interface BizOrgDocumentSummary {
  id: number;
  orgId: number;
  docType: OrgDocumentTypeValue;
  fileUrl: string;
  fileName: string | null;
  createdAt: string;
}

/** 商户组织摘要（列表/详情） */
export interface BizOrgSummary {
  id: number;
  name: string;
  orgType: BizOrgTypeValue;
  licenseNo: string | null;
  status: BizOrgStatusValue;
  contactPhone: string | null;
  description: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** 商户组织详情（含资质附件） */
export interface BizOrgDetail extends BizOrgSummary {
  documents: BizOrgDocumentSummary[];
}

/** 商户入驻申请入参 */
export interface BizOrgApplyInput {
  name: string;
  orgType: BizOrgTypeValue;
  licenseNo?: string;
  contactPhone?: string;
  description?: string;
  documents: Array<{
    docType: OrgDocumentTypeValue;
    fileUrl: string;
    fileName?: string;
  }>;
}

/** 平台审核商户入参 */
export interface BizOrgReviewInput {
  action: 'approve' | 'reject';
  reviewNote?: string;
}

/** 个人服务者摘要 */
export interface ServiceProviderSummary {
  id: number;
  userId: number;
  providerType: ProviderTypeValue;
  orgId: number | null;
  certStatus: CertStatusValue;
  creditScore: number;
  categoryCodes: string[];
  serviceRegions: string[] | null;
  displayName: string | null;
  bio: string | null;
  portfolioUrls: string[] | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** 服务者公开主页（仅已通过认证） */
export interface ServiceProviderPublicProfile {
  id: number;
  providerType: ProviderTypeValue;
  orgId: number | null;
  orgName: string | null;
  displayName: string | null;
  bio: string | null;
  categoryCodes: string[];
  serviceRegions: string[] | null;
  portfolioUrls: string[] | null;
  creditScore: number;
}

/** 个人服务者认证申请入参 */
export interface ServiceProviderApplyInput {
  providerType: ProviderTypeValue;
  categoryCodes: string[];
  serviceRegions?: string[];
  orgId?: number;
  displayName?: string;
  bio?: string;
  portfolioUrls?: string[];
}

/** 平台审核服务者入参 */
export interface ServiceProviderReviewInput {
  action: 'approve' | 'reject';
  reviewNote?: string;
}

/** 当前用户商户成员关系 */
export interface OrgMembershipSummary {
  orgId: number;
  orgRole: OrgRoleValue;
  org: BizOrgSummary;
}

/** 商户组织成员列表项（含用户展示名） */
export interface OrgMemberListItem {
  id: number;
  orgId: number;
  userId: number;
  orgRole: OrgRoleValue;
  nickname: string | null;
  username: string | null;
  createdAt: string;
}

/** 发单团体摘要（列表/详情） */
export interface DemandGroupSummary {
  id: number;
  name: string;
  groupType: DemandGroupTypeValue;
  headcount: number | null;
  ownerUserId: number;
  createdAt: string;
  updatedAt: string;
}

/** 团体成员摘要 */
export interface GroupMemberSummary {
  id: number;
  groupId: number;
  userId: number;
  memberRole: GroupMemberRoleValue;
  nickname: string | null;
  username: string | null;
  createdAt: string;
}

/** 发单团体详情（含成员列表） */
export interface DemandGroupDetail extends DemandGroupSummary {
  members: GroupMemberSummary[];
}

/** 当前用户团体成员关系 */
export interface GroupMembershipSummary {
  groupId: number;
  memberRole: GroupMemberRoleValue;
  group: DemandGroupSummary;
}

/** 创建/更新发单团体入参 */
export interface DemandGroupInput {
  name: string;
  groupType: DemandGroupTypeValue;
  headcount?: number;
}

/** 邀请团体协作者入参 */
export interface InviteGroupMemberInput {
  userId: number;
}

/** 需求单列表项 */
export interface ServiceDemandSummary {
  id: number;
  demandNo: string;
  publisherType: PublisherTypeValue;
  publisherUserId: number;
  /** 团体发单时的团体 ID；个人发单为 `null` */
  publisherGroupId: number | null;
  categoryCode: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  budgetType: BudgetTypeValue | null;
  /** 预计出行/服务人数；未填为 `null` */
  headcount: number | null;
  status: DemandStatusValue;
  routeId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 需求单详情 */
export interface ServiceDemandDetail extends ServiceDemandSummary {
  description: string | null;
  /** 发票抬头；未填为 `null`（本阶段仅存资料） */
  invoiceInfo: DemandInvoiceInfo | null;
}

/** marketplace 健康检查响应 */
export interface MarketplaceHealthPayload {
  ok: boolean;
  module: 'marketplace';
  timestamp: string;
}

/** 类目树 API 响应 */
export interface MarketplaceCategoriesPayload {
  categories: ServiceCategoryNode[];
}

/** 创建/更新需求单入参 */
export interface ServiceDemandInput {
  categoryCode: string;
  title: string;
  description?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetMin?: string;
  budgetMax?: string;
  budgetType?: BudgetTypeValue;
  routeId?: number;
  /**
   * 团体发单主体 ID；创建时传入则 `publisher_type=group`。
   * 更新草稿时忽略（不可改发单主体）。
   */
  publisherGroupId?: number;
  /** 预计人数；可选，1～100000 */
  headcount?: number | null;
  /** 发票抬头；传 `null` 可清空 */
  invoiceInfo?: DemandInvoiceInfo | null;
}

/** 需求单发布动作入参 */
export interface ServiceDemandPublishInput {
  action: 'publish';
}

/** 需求大厅筛选参数 */
export interface ServiceDemandHallQuery {
  page?: number;
  pageSize?: number;
  categoryCode?: string;
  destination?: string;
  keyword?: string;
}

/** 报价摘要 */
export interface DemandQuoteSummary {
  id: number;
  demandId: number;
  orgId: number | null;
  orgName: string | null;
  providerUserId: number | null;
  providerDisplayName: string | null;
  amount: string;
  proposalText: string | null;
  status: QuoteStatusValue;
  /** 服务者信用分；商户报价无个人服务者时为 `null` */
  providerCreditScore: number | null;
  /** 当前列表排序理由 key（见 `QuoteSortReason`） */
  sortReasonKey: QuoteSortReasonValue;
  createdAt: string;
  updatedAt: string;
}

/** 站内通知摘要（M4） */
export interface MarketplaceNotificationSummary {
  id: number;
  userId: number;
  type: MarketplaceNotificationTypeValue;
  refType: MarketplaceNotificationRefTypeValue;
  refId: number;
  messageKey: string;
  payload: Record<string, string | number | null> | null;
  readAt: string | null;
  createdAt: string;
}

/** 匹配候选服务者（引擎内部/调试用） */
export interface MarketplaceMatchCandidate {
  providerId: number;
  userId: number;
  score: number;
  matchedCategory: boolean;
  matchedRegion: boolean;
  matchedSchedule: boolean;
}

/** 提交报价入参 */
export interface DemandQuoteCreateInput {
  amount: string;
  proposalText?: string;
  orgId?: number;
}

/** 选定报价入参 */
export interface DemandSelectQuoteInput {
  quoteId: number;
}

/** 服务履约订单摘要 */
export interface ServiceOrderSummary {
  id: number;
  orderNo: string;
  /** 发单成单时有值；标品直购为 `null` */
  demandId: number | null;
  quoteId: number | null;
  /** 标品直购时有值；发单成单为 `null` */
  productId: number | null;
  skuId: number | null;
  buyerUserId: number;
  sellerOrgId: number | null;
  sellerProviderUserId: number | null;
  /** 履约领队用户 ID；未指派为 `null` */
  assignedGuideUserId: number | null;
  /** 指派时间；未指派为 `null` */
  assignedAt: string | null;
  totalAmount: string;
  platformFee: string;
  status: ServiceOrderStatusValue;
  createdAt: string;
  updatedAt: string;
}

/** 服务履约订单详情 */
export interface ServiceOrderDetail extends ServiceOrderSummary {
  demandTitle: string | null;
  demandNo: string | null;
  /** 直购标品标题；发单成单为 `null` */
  productTitle: string | null;
  /** 关联需求行程开始日（YYYY-MM-DD）；无需求或未填为 `null` */
  demandStartDate: string | null;
  /** 关联需求行程结束日（YYYY-MM-DD）；无需求或未填为 `null` */
  demandEndDate: string | null;
  /** 已指派领队昵称 */
  assignedGuideNickname: string | null;
  /** 已指派领队用户名 */
  assignedGuideUsername: string | null;
}

/** 履约订单状态推进入参 */
export interface ServiceOrderStatusInput {
  status: ServiceOrderStatusValue;
}

/** 指派/清除履约领队入参（`guideUserId` 为 null 时清除） */
export interface ServiceOrderAssignInput {
  guideUserId: number | null;
}

/** 履约汇报摘要（时间线项） */
export interface ServiceOrderReportSummary {
  id: number;
  orderId: number;
  authorUserId: number;
  authorNickname: string | null;
  authorUsername: string | null;
  reportType: ServiceOrderReportTypeValue;
  content: string | null;
  photos: string[];
  latitude: string | null;
  longitude: string | null;
  placeName: string | null;
  createdAt: string;
}

/** 创建履约汇报入参 */
export interface ServiceOrderReportCreateInput {
  reportType: ServiceOrderReportTypeValue;
  content?: string;
  photos?: string[];
  latitude?: number;
  longitude?: number;
  placeName?: string;
}

/** 标品 SKU 摘要 */
export interface ServiceProductSkuSummary {
  id: number;
  productId: number;
  name: string;
  price: string;
  stock: number;
  sortOrder: number;
}

/** 标品摘要（列表） */
export interface ServiceProductSummary {
  id: number;
  orgId: number;
  orgName: string | null;
  categoryCode: string;
  title: string;
  coverUrl: string | null;
  destination: string | null;
  status: ProductStatusValue;
  /** 最低 SKU 价；无 SKU 时为 `null` */
  minPrice: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 标品详情 */
export interface ServiceProductDetail extends ServiceProductSummary {
  description: string | null;
  skus: ServiceProductSkuSummary[];
}

/** 创建/更新标品入参（含至少一个 SKU） */
export interface ServiceProductInput {
  categoryCode: string;
  title: string;
  description?: string;
  coverUrl?: string;
  destination?: string;
  skus: Array<{
    name: string;
    price: string;
    stock: number;
    sortOrder?: number;
  }>;
}

/** 标品大厅查询 */
export interface ServiceProductHallQuery {
  page?: number;
  pageSize?: number;
  categoryCode?: string;
  destination?: string;
  keyword?: string;
  orgId?: number;
}

/** 标品直购入参 */
export interface ServiceProductPurchaseInput {
  skuId: number;
  quantity?: number;
}

/** 商户结算台账摘要（M6） */
export interface OrgSettlementSummary {
  id: number;
  orgId: number;
  orderId: number;
  orderNo: string;
  grossAmount: string;
  platformFee: string;
  netAmount: string;
  status: SettlementStatusValue;
  createdAt: string;
  settledAt: string | null;
}

/** 退款占位响应（真退款归 E2/微信） */
export interface ServiceOrderRefundPlaceholder {
  orderId: number;
  status: 'refund_pending';
  messageKey: string;
}

/** 商户工作台上下文（入驻状态与可报价身份） */
export interface MarketplacePartnerContext {
  memberships: OrgMembershipSummary[];
  provider: ServiceProviderSummary | null;
  /** 个人服务者是否已通过认证、可代个人报价 */
  canQuoteAsProvider: boolean;
  /** 状态为 active 且当前用户为成员的 orgId 列表，可代商户报价 */
  quotableOrgIds: number[];
}

/** 服务方「我的报价」列表项（含需求摘要） */
export interface PartnerQuoteListItem extends DemandQuoteSummary {
  demandTitle: string | null;
  demandNo: string | null;
  demandStatus: DemandStatusValue;
}

/** 履约评价摘要 */
export interface ServiceOrderReviewSummary {
  id: number;
  orderId: number;
  targetType: ServiceOrderReviewTargetTypeValue;
  fromUserId: number;
  fromNickname: string | null;
  fromUsername: string | null;
  toTargetType: ServiceOrderRevieweeTypeValue;
  toUserId: number | null;
  toOrgId: number | null;
  toOrgName: string | null;
  toProviderDisplayName: string | null;
  rating: number;
  content: string | null;
  tags: string[];
  replyContent: string | null;
  replyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 创建履约评价入参 */
export interface ServiceOrderReviewCreateInput {
  targetType: ServiceOrderReviewTargetTypeValue;
  rating: number;
  content?: string;
  tags?: string[];
}

/** 回复履约评价入参 */
export interface ServiceOrderReviewReplyInput {
  replyContent: string;
}

/** 履约争议摘要 */
export interface ServiceOrderDisputeSummary {
  id: number;
  orderId: number;
  orderNo: string | null;
  initiatorUserId: number;
  initiatorNickname: string | null;
  initiatorUsername: string | null;
  respondentType: ServiceOrderRevieweeTypeValue;
  respondentUserId: number | null;
  respondentOrgId: number | null;
  respondentOrgName: string | null;
  type: ServiceOrderDisputeTypeValue;
  reason: string | null;
  status: ServiceOrderDisputeStatusValue;
  platformNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 创建履约争议入参 */
export interface ServiceOrderDisputeCreateInput {
  type: ServiceOrderDisputeTypeValue;
  reason: string;
}

/** 平台仲裁争议入参 */
export interface ServiceOrderDisputeResolveInput {
  status: ServiceOrderDisputeStatusValue;
  platformNote?: string;
}

/** 管理端争议列表筛选参数 */
export interface ServiceOrderDisputeAdminQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: string;
  type?: string;
}
