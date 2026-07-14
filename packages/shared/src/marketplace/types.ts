import type {
  BizOrgStatusValue,
  BizOrgTypeValue,
  BudgetTypeValue,
  CertStatusValue,
  DemandGroupTypeValue,
  DemandStatusValue,
  GroupMemberRoleValue,
  OrgDocumentTypeValue,
  OrgRoleValue,
  ProviderTypeValue,
  PublisherTypeValue,
  QuoteStatusValue,
  ServiceCategoryNode,
  ServiceOrderStatusValue,
} from './constants.js';

/** 商户组织结算配置（JSON 快照） */
export interface BizOrgSettlementConfig {
  platformFeeRate?: number;
  settlementCycleDays?: number;
  bankAccountHint?: string;
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
  categoryCode: string;
  title: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  budgetMin: string | null;
  budgetMax: string | null;
  budgetType: BudgetTypeValue | null;
  status: DemandStatusValue;
  routeId: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 需求单详情 */
export interface ServiceDemandDetail extends ServiceDemandSummary {
  description: string | null;
  publisherGroupId: number | null;
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
  createdAt: string;
  updatedAt: string;
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
  demandId: number;
  quoteId: number | null;
  buyerUserId: number;
  sellerOrgId: number | null;
  sellerProviderUserId: number | null;
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
}

/** 履约订单状态推进入参 */
export interface ServiceOrderStatusInput {
  status: ServiceOrderStatusValue;
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
