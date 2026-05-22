export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface UserInfo {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  phone: string | null;
  email: string | null;
  /** 用户兴趣偏好标签 */
  interestTags: string[] | null;
  status: number;
  roles: string[];
}

/** 更新当前用户资料（PUT /users/me） */
export interface UpdateUserProfileRequest {
  nickname?: string;
  avatar?: string | null;
  email?: string | null;
  interestTags?: string[];
}

export interface LoginResult {
  token: string;
  user: UserInfo;
}

/** 路线日程中的 POI 节点（含景点、具体餐厅/酒店；笼统「午餐」等不入库） */
export interface RouteDayAttraction {
  attractionId?: number;
  name: string;
  time: string;
  cost: number;
  description: string;
  /** attraction | restaurant | hotel | meal | transport | other */
  poiType?: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteDayPlan {
  date: string;
  title: string;
  attractions: RouteDayAttraction[];
}

export interface RouteDetailPayload {
  days: RouteDayPlan[];
  isAiGenerated?: boolean;
  unlockPrice?: number;
  isUnlocked?: boolean;
  matchedCity?: string;
  generationSource?: 'llm' | 'template';
  llmProvider?: string;
  sourcePrompt?: string;
}

export interface AttractionInfo {
  id: number;
  name: string;
  /** attraction | restaurant | hotel */
  category: string;
  city: string;
  cityCode: string;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  description: string | null;
  ticketPrice: number;
  aliases: string[] | null;
  status: number;
  source: string;
  priceSource: string | null;
  matchConfidence: number | null;
  priceUpdatedAt: string | null;
  verifiedAt: string | null;
}

export interface AttractionCitySummary {
  city: string;
  cityCode: string;
  count: number;
}

export interface TravelRouteInfo {
  id: number;
  name: string;
  description: string | null;
  budgetRange: string | null;
  days: number;
  interestTags: string[] | null;
  routeDetail: Record<string, unknown> | null;
  creatorId: number;
  status: number;
  viewCount?: number;
  likeCount?: number;
  collectCount?: number;
  commentCount?: number;
  /** 是否已公开到广场 */
  isPublic?: boolean;
  /** 创建者昵称（广场列表展示） */
  creatorNickname?: string | null;
  /** 创建者头像 */
  creatorAvatar?: string | null;
  /** 当前用户是否已点赞（需登录） */
  isLiked?: boolean;
  /** 当前用户是否已收藏（需登录） */
  isFavorited?: boolean;
  isAiGenerated?: boolean;
  unlockPrice?: number;
  isUnlocked?: boolean;
  generationSource?: 'llm' | 'template';
  llmProvider?: 'deepseek' | 'lmstudio';
  /** AI 生成时用户输入的原始需求 */
  sourcePrompt?: string | null;
}

/** 路线列表查询（GET /routes） */
export type RouteListScope = 'mine' | 'hot' | 'favorites' | 'plaza';

export type RouteListSort = 'recent' | 'hot' | 'views';

export interface RouteListQuery {
  scope?: RouteListScope;
  status?: number;
  sort?: RouteListSort;
  limit?: number;
}

/** 草稿路线编辑（PUT /routes/:id，仅 status=草稿） */
export interface UpdateRouteDraftRequest {
  name?: string;
  description?: string | null;
  budgetRange?: string | null;
  days?: number;
  interestTags?: string[];
  routeDetail?: RouteDetailPayload;
}

export interface RouteLikeResult {
  liked: boolean;
  likeCount: number;
}

export interface RouteFavoriteResult {
  favorited: boolean;
  collectCount: number;
}

/** 公开分享到广场 */
export interface SetRoutePublicShareRequest {
  isPublic: boolean;
}

export interface RouteCommentInfo {
  id: number;
  routeId: number;
  userId: number;
  userNickname: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

export interface CreateRouteCommentRequest {
  content: string;
}

export type LlmProviderChoice = 'auto' | 'deepseek' | 'lmstudio';

export interface LlmProviderStatusItem {
  id: 'deepseek' | 'lmstudio';
  label: string;
  configured: boolean;
  available: boolean;
  model?: string;
  error?: string;
}

export interface LlmStatusInfo {
  enabled: boolean;
  available: boolean;
  model?: string;
  defaultProvider?: string;
  deepseekConfigured?: boolean;
  providers?: LlmProviderStatusItem[];
  error?: string;
  message?: string;
}

export interface LlmProviderOption {
  id: LlmProviderChoice;
  label: string;
  available: boolean;
}

export interface GenerateRouteRequest {
  prompt: string;
  days?: number;
  budget?: string;
  provider?: LlmProviderChoice;
}

/** 修改 prompt 后重新生成（与 GenerateRouteRequest 字段一致） */
export type RegenerateRouteRequest = GenerateRouteRequest;

export interface OrderInfo {
  id: number;
  orderNo: string;
  userId: number;
  orderType: string;
  productId: number;
  productName: string;
  totalAmount: string;
  status: number;
  paidAt: string | null;
  createdAt: string;
}

/** 支付渠道：mock 模拟 / wechat_jsapi 微信小程序 */
export type OrderPaymentChannel = 'mock' | 'wechat_jsapi';

/** 微信小程序调起支付参数 */
export interface WechatJsapiPayParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'RSA';
  paySign: string;
}

/** POST /orders/:id/prepay 响应 */
export interface OrderPrepayResult {
  channel: OrderPaymentChannel;
  orderId: number;
  orderNo: string;
  totalAmount: string;
  wechat?: WechatJsapiPayParams;
}

export interface CheckInResult {
  checkIn: CheckInInfo;
  newAchievements: AchievementInfo[];
  newBadges: UserBadgeInfo[];
}

export interface CheckInInfo {
  id: number;
  userId: number;
  routeId: number;
  attractionId: number | null;
  location: {
    latitude?: number;
    longitude?: number;
    address?: string;
    placeName?: string;
  };
  cityCode: string;
  /** 城市名称（由 cityCode 解析，展示用） */
  city?: string | null;
  photos: string[];
  pointsEarned: number;
  gpsAccuracy?: number | null;
  /** 打卡时与目标景点的距离（米），仅围栏校验通过时有值 */
  distanceMeters?: number | null;
  checkedAt: string;
  status: number;
  remark: string | null;
}

export interface AchievementInfo {
  id: number;
  userId: number;
  /** 成就编码，与 achievement_definitions.achievement_code 对应 */
  achievementType: string;
  achievementCode: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  pointsReward: number;
  unlockedAt: string;
}

export interface AchievementDefinitionInfo {
  id: number;
  achievementCode: string;
  name: string;
  description: string | null;
  category: string;
  conditionType: string;
  conditionValue: Record<string, unknown> | null;
  iconUrl: string | null;
  pointsReward: number;
  sortOrder: number;
}

export interface AchievementProgress {
  current: number;
  target: number;
}

export interface AchievementCatalogItem extends AchievementDefinitionInfo {
  unlocked: boolean;
  unlockTime?: string | null;
  progress?: AchievementProgress | null;
}

export interface BadgeInfo {
  id: number;
  badgeCode: string;
  name: string;
  description: string | null;
  category: string;
  conditionType: string;
  conditionValue: Record<string, unknown> | null;
  iconUrl: string | null;
  rarity: string;
  pointsReward: number;
}

export interface BadgeProgress {
  current: number;
  target: number;
}

export interface BadgeCatalogItem extends BadgeInfo {
  unlocked: boolean;
  unlockTime?: string | null;
  progress?: BadgeProgress | null;
}

export interface UserBadgeInfo {
  id: number;
  userId: number;
  badgeId: number;
  badge: BadgeInfo;
  unlockTime: string;
  isDisplayed: boolean;
  progress: Record<string, unknown> | null;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  nickname: string;
  avatar: string | null;
  checkinCount: number;
  totalPoints: number;
  /** 当前榜单主指标值 */
  value: number;
  isMe?: boolean;
}

export interface LeaderboardResult {
  period: string;
  metric: string;
  periodStart: string;
  periodEnd: string;
  entries: LeaderboardEntry[];
  myRank: number | null;
  myValue: number | null;
}
