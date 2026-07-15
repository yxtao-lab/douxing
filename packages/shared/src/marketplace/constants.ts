/** 商户组织状态 */
export const BizOrgStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  REJECTED: 'rejected',
  FROZEN: 'frozen',
} as const;

/** 商户资质附件类型 */
export const OrgDocumentType = {
  LICENSE: 'license',
  PORTFOLIO: 'portfolio',
} as const;

export type OrgDocumentTypeValue = (typeof OrgDocumentType)[keyof typeof OrgDocumentType];

/** 合法资质附件类型列表 */
export const ORG_DOCUMENT_TYPES: OrgDocumentTypeValue[] = [
  OrgDocumentType.LICENSE,
  OrgDocumentType.PORTFOLIO,
];

/**
 * 判断资质附件类型是否合法。
 *
 * @param value - 附件类型字符串
 * @returns 合法为 true
 */
export function isValidOrgDocumentType(value: string): value is OrgDocumentTypeValue {
  return ORG_DOCUMENT_TYPES.includes(value as OrgDocumentTypeValue);
}

export type BizOrgStatusValue = (typeof BizOrgStatus)[keyof typeof BizOrgStatus];

/** 商户组织类型 */
export const BizOrgType = {
  TRAVEL_AGENCY: 'travel_agency',
  PHOTO_STUDIO: 'photo_studio',
  GUIDE_STUDIO: 'guide_studio',
  OUTDOOR_CLUB: 'outdoor_club',
  OTHER: 'other',
} as const;

export type BizOrgTypeValue = (typeof BizOrgType)[keyof typeof BizOrgType];

/** 组织成员角色 */
export const OrgRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  STAFF: 'staff',
  GUIDE: 'guide',
} as const;

export type OrgRoleValue = (typeof OrgRole)[keyof typeof OrgRole];

/** 个人服务者类型 */
export const ProviderType = {
  GUIDE: 'guide',
  PHOTOGRAPHER: 'photographer',
  MODEL: 'model',
  RETOUCHER: 'retoucher',
  LEADER: 'leader',
} as const;

export type ProviderTypeValue = (typeof ProviderType)[keyof typeof ProviderType];

/** 服务者认证状态 */
export const CertStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type CertStatusValue = (typeof CertStatus)[keyof typeof CertStatus];

/** 发单主体类型 */
export const PublisherType = {
  USER: 'user',
  GROUP: 'group',
} as const;

export type PublisherTypeValue = (typeof PublisherType)[keyof typeof PublisherType];

/** 需求单状态 */
export const DemandStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  QUOTING: 'quoting',
  SELECTED: 'selected',
  CONTRACTED: 'contracted',
  IN_SERVICE: 'in_service',
  COMPLETED: 'completed',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export type DemandStatusValue = (typeof DemandStatus)[keyof typeof DemandStatus];

/** 报价状态 */
export const QuoteStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
} as const;

export type QuoteStatusValue = (typeof QuoteStatus)[keyof typeof QuoteStatus];

/** 服务履约订单状态 */
export const ServiceOrderStatus = {
  PENDING_PAY: 'pending_pay',
  PAID: 'paid',
  IN_PROGRESS: 'in_progress',
  DELIVERED: 'delivered',
  CONFIRMED: 'confirmed',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
} as const;

export type ServiceOrderStatusValue = (typeof ServiceOrderStatus)[keyof typeof ServiceOrderStatus];

/** 团体类型 */
export const DemandGroupType = {
  COMPANY: 'company',
  SCHOOL: 'school',
  COMMUNITY: 'community',
  OTHER: 'other',
} as const;

export type DemandGroupTypeValue = (typeof DemandGroupType)[keyof typeof DemandGroupType];

/** 合法团体类型列表 */
export const DEMAND_GROUP_TYPES: DemandGroupTypeValue[] = [
  DemandGroupType.COMPANY,
  DemandGroupType.SCHOOL,
  DemandGroupType.COMMUNITY,
  DemandGroupType.OTHER,
];

/**
 * 判断团体类型是否合法。
 *
 * @param value - 团体类型字符串
 * @returns 合法为 true
 */
export function isValidDemandGroupType(value: string): value is DemandGroupTypeValue {
  return DEMAND_GROUP_TYPES.includes(value as DemandGroupTypeValue);
}

/** 团体成员角色 */
export const GroupMemberRole = {
  OWNER: 'owner',
  COLLABORATOR: 'collaborator',
} as const;

export type GroupMemberRoleValue = (typeof GroupMemberRole)[keyof typeof GroupMemberRole];

/** 合法团体成员角色列表 */
export const GROUP_MEMBER_ROLES: GroupMemberRoleValue[] = [
  GroupMemberRole.OWNER,
  GroupMemberRole.COLLABORATOR,
];

/**
 * 判断团体成员角色是否合法。
 *
 * @param value - 成员角色字符串
 * @returns 合法为 true
 */
export function isValidGroupMemberRole(value: string): value is GroupMemberRoleValue {
  return GROUP_MEMBER_ROLES.includes(value as GroupMemberRoleValue);
}

/** 发票抬头类型（个人 / 企业） */
export const InvoiceTitleType = {
  PERSONAL: 'personal',
  COMPANY: 'company',
} as const;

export type InvoiceTitleTypeValue = (typeof InvoiceTitleType)[keyof typeof InvoiceTitleType];

/** 合法发票抬头类型列表 */
export const INVOICE_TITLE_TYPES: InvoiceTitleTypeValue[] = [
  InvoiceTitleType.PERSONAL,
  InvoiceTitleType.COMPANY,
];

/**
 * 判断发票抬头类型是否合法。
 *
 * @param value - 抬头类型字符串
 * @returns 合法为 true
 */
export function isValidInvoiceTitleType(value: string): value is InvoiceTitleTypeValue {
  return INVOICE_TITLE_TYPES.includes(value as InvoiceTitleTypeValue);
}

/** 预算类型 */
export const BudgetType = {
  FIXED: 'fixed',
  RANGE: 'range',
  NEGOTIABLE: 'negotiable',
} as const;

export type BudgetTypeValue = (typeof BudgetType)[keyof typeof BudgetType];

/** 服务类目树节点 */
export interface ServiceCategoryNode {
  code: string;
  labelKey: string;
  children?: ServiceCategoryNode[];
}

/**
 * 模块 B 服务类目树（与发单接单平台 §3 对齐）。
 * 展示文案通过 `marketplace.category.*` i18n 键解析。
 */
export const SERVICE_CATEGORY_TREE: ServiceCategoryNode[] = [
  {
    code: 'travel',
    labelKey: 'marketplace.category.travel.label',
    children: [
      { code: 'travel.group_tour', labelKey: 'marketplace.category.travel.groupTour' },
      { code: 'travel.custom_tour', labelKey: 'marketplace.category.travel.customTour' },
      { code: 'travel.outdoor', labelKey: 'marketplace.category.travel.outdoor' },
      { code: 'travel.guide', labelKey: 'marketplace.category.travel.guide' },
    ],
  },
  {
    code: 'photo',
    labelKey: 'marketplace.category.photo.label',
    children: [
      { code: 'photo.travel_shoot', labelKey: 'marketplace.category.photo.travelShoot' },
      { code: 'photo.wedding', labelKey: 'marketplace.category.photo.wedding' },
      { code: 'photo.commercial', labelKey: 'marketplace.category.photo.commercial' },
      { code: 'photo.team', labelKey: 'marketplace.category.photo.team' },
    ],
  },
  {
    code: 'talent',
    labelKey: 'marketplace.category.talent.label',
    children: [
      { code: 'talent.photographer', labelKey: 'marketplace.category.talent.photographer' },
      { code: 'talent.model', labelKey: 'marketplace.category.talent.model' },
      { code: 'talent.retoucher', labelKey: 'marketplace.category.talent.retoucher' },
    ],
  },
];

/** 所有合法类目 code（扁平列表，含一级与叶子节点） */
export const SERVICE_CATEGORY_CODES: string[] = (() => {
  const codes: string[] = [];
  for (const node of SERVICE_CATEGORY_TREE) {
    codes.push(node.code);
    for (const child of node.children ?? []) {
      codes.push(child.code);
    }
  }
  return codes;
})();

/**
 * 判断类目 code 是否在预置类目树中。
 *
 * @param code - 点分路径类目 code
 * @returns 合法为 true
 */
export function isValidServiceCategoryCode(code: string): boolean {
  return SERVICE_CATEGORY_CODES.includes(code);
}

/** 站内通知类型（M4） */
export const MarketplaceNotificationType = {
  DEMAND_MATCH: 'demand_match',
} as const;

export type MarketplaceNotificationTypeValue =
  (typeof MarketplaceNotificationType)[keyof typeof MarketplaceNotificationType];

/** 通知关联实体类型 */
export const MarketplaceNotificationRefType = {
  SERVICE_DEMAND: 'service_demand',
} as const;

export type MarketplaceNotificationRefTypeValue =
  (typeof MarketplaceNotificationRefType)[keyof typeof MarketplaceNotificationRefType];

/**
 * 报价列表默认排序理由（发单方可见；客户端按 key 做 i18n）。
 */
export const QuoteSortReason = {
  CREDIT_THEN_AMOUNT: 'credit_then_amount',
} as const;

export type QuoteSortReasonValue = (typeof QuoteSortReason)[keyof typeof QuoteSortReason];

/**
 * 匹配规则默认权重（类目 / 区域 / 档期；总和建议 100）。
 * 服务端可用同结构覆盖。
 */
export const DEFAULT_MATCH_WEIGHTS = {
  category: 40,
  region: 40,
  schedule: 20,
} as const;

export type MatchWeightConfig = {
  category: number;
  region: number;
  schedule: number;
};

/** 订单履约完成时服务者信用加分（占位规则） */
export const CREDIT_DELTA_ORDER_CONFIRMED = 5;

/** 纠纷扣减信用分（占位规则，待纠纷表落地后接入） */
export const CREDIT_DELTA_DISPUTE = -10;

/** 平台默认抽佣比例（商户 settlement_config 未配置时回落） */
export const DEFAULT_PLATFORM_FEE_RATE = 0.05;

/** 商户结算台账状态（M6） */
export const SettlementStatus = {
  PENDING: 'pending',
  SETTLED: 'settled',
  VOID: 'void',
} as const;

export type SettlementStatusValue = (typeof SettlementStatus)[keyof typeof SettlementStatus];

/** 标品上下架状态（M5） */
export const ProductStatus = {
  DRAFT: 'draft',
  ON_SALE: 'on_sale',
  OFF_SALE: 'off_sale',
} as const;

export type ProductStatusValue = (typeof ProductStatus)[keyof typeof ProductStatus];

/** 可公开浏览的标品状态 */
export const PUBLIC_PRODUCT_STATUSES: ProductStatusValue[] = [ProductStatus.ON_SALE];

