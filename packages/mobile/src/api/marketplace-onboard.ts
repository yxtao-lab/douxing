import type {
  BizOrgApplyInput,
  BizOrgDetail,
  OrgMembershipSummary,
  ServiceProviderApplyInput,
  ServiceProviderSummary,
} from '@douxing/shared';
import { mobileT } from '@/i18n/mobileT';
import { assertRemoteApiBase, getApiBaseUrl } from '@/utils/api-base';
import { getApiAcceptLanguage } from '@/utils/api-locale-header';
import { resolveClientRequestErrorMessage } from '@douxing/shared';
import { request, TOKEN_KEY } from '@/utils/request';

/** 资质文件上传结果 */
export interface MarketplaceDocumentUploadResult {
  fileUrl: string;
  publicUrl: string;
  fileName: string;
}

/**
 * 上传商户入驻资质文件。
 *
 * @param filePath - 本地临时文件路径
 * @returns 存储路径与对外 URL
 */
export function uploadMarketplaceDocument(filePath: string): Promise<MarketplaceDocumentUploadResult> {
  assertRemoteApiBase('上传资质文件');
  const token = uni.getStorageSync(TOKEN_KEY) as string;
  const url = `${getApiBaseUrl()}/marketplace/orgs/documents/upload`;

  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        try {
          const body = JSON.parse(res.data as string) as {
            code: number;
            message: string;
            data: MarketplaceDocumentUploadResult;
          };
          if (body.code === 0) {
            resolve(body.data);
            return;
          }
          reject(new Error(body.message || mobileT('common.uploadFailed')));
        } catch {
          reject(new Error(mobileT('common.invalidResponse')));
        }
      },
      fail: (err) =>
        reject(new Error(resolveClientRequestErrorMessage(err.errMsg, getApiAcceptLanguage()))),
    });
  });
}

/**
 * 提交商户入驻申请。
 *
 * @param body - 入驻表单
 * @returns 新建商户详情
 */
export function applyMarketplaceOrg(body: BizOrgApplyInput) {
  return request<BizOrgDetail>('/marketplace/orgs/apply', { method: 'POST', data: body });
}

/**
 * 查询当前用户的商户成员关系列表。
 *
 * @returns 成员关系列表（含组织摘要）
 */
export function fetchMyOrgMemberships() {
  return request<{ items: OrgMembershipSummary[] }>('/marketplace/orgs/mine').then(
    (r) => r.items ?? [],
  );
}

/**
 * 提交个人服务者认证申请。
 *
 * @param body - 认证表单
 * @returns 服务者摘要
 */
export function applyMarketplaceProvider(body: ServiceProviderApplyInput) {
  return request<ServiceProviderSummary>('/marketplace/providers/apply', {
    method: 'POST',
    data: body,
  });
}

/**
 * 查询当前用户的服务者认证记录。
 *
 * @returns 服务者摘要；未申请时为 null
 */
export function fetchMyServiceProvider() {
  return request<{ provider: ServiceProviderSummary | null }>('/marketplace/providers/me').then(
    (r) => r.provider ?? null,
  );
}
