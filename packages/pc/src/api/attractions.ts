import http from './http';
import type { ApiResponse, AttractionInfo } from '@douxing/shared';

/**
 * 获取单个景点详情。
 *
 * @param id - 景点 ID
 * @returns 景点信息
 */
export async function fetchAttractionDetail(id: number) {
  const { data } = await http.get<ApiResponse<AttractionInfo>>(`/attractions/${id}`);
  return data.data;
}
