import type {
  BizOrgStatusValue,
  BizOrgTypeValue,
  BudgetTypeValue,
  CertStatusValue,
  DemandStatusValue,
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

/** 商户组织摘要（列表/详情） */
export interface BizOrgSummary {
  id: number;
  name: string;
  orgType: BizOrgTypeValue;
  licenseNo: string | null;
  status: BizOrgStatusValue;
  createdAt: string;
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
