import http from './http';
import type {
  ApiResponse,
  AttractionInfo,
  PaginatedResult,
  TravelRouteInfo,
} from '@douxing/shared';

/** 场景标签预设项（slug + 当前语言展示文案） */
export interface SceneTagOption {
  slug: string;
  label: string;
}

/** GET /scenes/tags 返回体 */
interface SceneTagsResponse {
  tags: SceneTagOption[];
}

/** GET /scenes/:slug 返回体 */
export interface SceneDetailResponse {
  scene: { slug: string; label: string };
  attractions: AttractionInfo[];
  routes: PaginatedResult<TravelRouteInfo>;
}

/**
 * 获取所有场景标签预设（含当前语言展示文案）。
 *
 * @returns 场景标签列表；供首页 chip 行渲染
 */
export async function fetchSceneTags() {
  const { data } = await http.get<ApiResponse<SceneTagsResponse>>('/scenes/tags');
  return data.data;
}

/**
 * 获取指定场景的专题页聚合数据（景点 + 公开路线）。
 *
 * @param slug - 场景标签 slug
 * @param options - 景点/路线数量与分页参数
 */
export async function fetchSceneDetail(
  slug: string,
  options?: { attractionLimit?: number; page?: number; pageSize?: number },
) {
  const { data } = await http.get<ApiResponse<SceneDetailResponse>>(
    `/scenes/${encodeURIComponent(slug)}`,
    { params: options },
  );
  return data.data;
}
