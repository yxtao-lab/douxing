import type {
  BizOrgStatusValue,
  BizOrgTypeValue,
  BudgetTypeValue,
  CertStatusValue,
  DemandStatusValue,
  OrgDocumentTypeValue,
  OrgRoleValue,
  ProviderTypeValue,
  PublisherTypeValue,
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

/** 服务履约订单摘要（M0 占位类型，M2 完善） */
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
}
