import {
  BizOrgStatus,
  CertStatus,
  type MarketplacePartnerContext,
} from '@douxing/shared';
import { listOrgMembershipsByUser } from './marketplace-org-onboard.service.js';
import { getServiceProviderByUserId } from './marketplace-provider.service.js';

/**
 * 读取商户工作台上下文：成员关系、服务者档案与可报价身份。
 *
 * @param userId - 当前用户 ID
 * @returns 入驻状态与可报价 org / 个人身份摘要
 */
export async function getMarketplacePartnerContext(userId: number): Promise<MarketplacePartnerContext> {
  const memberships = await listOrgMembershipsByUser(userId);
  const provider = await getServiceProviderByUserId(userId);
  const canQuoteAsProvider = provider?.certStatus === CertStatus.APPROVED;
  const quotableOrgIds = memberships
    .filter((item) => item.org.status === BizOrgStatus.ACTIVE)
    .map((item) => item.orgId);

  return {
    memberships,
    provider,
    canQuoteAsProvider,
    quotableOrgIds,
  };
}
