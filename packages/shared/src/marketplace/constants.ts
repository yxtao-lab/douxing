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

/** 团体成员角色 */
export const GroupMemberRole = {
  OWNER: 'owner',
  COLLABORATOR: 'collaborator',
} as const;

export type GroupMemberRoleValue = (typeof GroupMemberRole)[keyof typeof GroupMemberRole];

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
