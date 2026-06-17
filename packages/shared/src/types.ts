export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  /** 稳定错误码，客户端可按需做二次翻译或埋点 */
  messageKey?: string;
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
  /** 会员等级，见 MemberLevel */
  memberLevel: number;
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
  /** 展示用封面（路线详情 API 注入，不入库 JSON） */
  coverImageUrl?: string;
}

/** H9：交通段类型 */
export type RouteTransitKind = 'intercity' | 'local';

/** H9：交通方式 */
export type RouteTransitMode =
  | 'train'
  | 'flight'
  | 'subway'
  | 'bus'
  | 'taxi'
  | 'walk'
  | 'drive';

/** H9-4 / H9+：玩法段间交通理由键 */
export type PlaybookTransitReasonKey =
  | 'classicWalk'
  | 'scenicWalk'
  | 'sightseeingBus'
  | 'ferry'
  | 'taxiShort';

/** H9+：玩法段间边 */
export interface RoutePlaybookSegmentEdge {
  from: string;
  to: string;
  mode: RouteTransitMode;
  reasonKey: PlaybookTransitReasonKey;
  fromAliases?: string[];
  toAliases?: string[];
}

/** H9+：经典玩法动线（DB / 管理端） */
export interface RoutePlaybookInfo {
  id: string;
  city: string;
  scope: string;
  keywords: string[];
  themes: string[];
  classicOrder: string[];
  segments: RoutePlaybookSegmentEdge[];
  summaryZh: string;
  summaryEn: string;
  enabled: boolean;
  sortOrder: number;
}

/** H9-3：跨城班次数据来源 */
export type RouteScheduleSource = 'api' | 'catalog' | 'template';

/** H9：结构化交通段（Enricher 产出） */
export interface RouteTransitSegment {
  kind: RouteTransitKind;
  mode: RouteTransitMode;
  from: string;
  to: string;
  /** 如 08:30-10:45 */
  time?: string;
  durationMinutes: number;
  cost?: number;
  /** 跨城订票链接（班次库/第三方 API 为真实跳转；模板为演示） */
  bookingUrl?: string;
  /** 高德失败 Haversine 估算，或仅有参考模板时为 true */
  estimated?: boolean;
  description?: string;
  /** H9-3：车次/航班号 */
  scheduleNo?: string;
  /** H9-3：班次数据来源 */
  scheduleSource?: RouteScheduleSource;
}

/** H9：每日住宿（Enricher 产出） */
/** H9-2：住宿数据来源 */
export type RouteLodgingSource =
  | 'content_library'
  | 'amap_poi'
  | 'amap_geocode'
  | 'fallback';

export interface RouteDayLodging {
  name: string;
  area?: string;
  tier?: LodgingTier;
  cost?: number;
  /** 入住时段，如 21:00 或 21:00-22:00 */
  time?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  /** H9-2：来自内容库的酒店 ID */
  attractionId?: number;
  /** H9-2：住宿推荐来源 */
  source?: RouteLodgingSource;
}

export interface RouteDayPlan {
  /** UI 展示：第 N 天 / Day N */
  date: string;
  /** 系统用 ISO 日历日 YYYY-MM-DD（班次、开放时长、闭馆日） */
  calendarDate?: string;
  title: string;
  /** 游玩 POI（不含 Enricher 负责的 hotel/transport） */
  attractions: RouteDayAttraction[];
  /** H9：当日推荐住宿 */
  lodging?: RouteDayLodging;
  /** H9：市内/跨城交通段 */
  transit?: RouteTransitSegment[];
  /** H9：排程警告（如时间窗冲突） */
  warnings?: string[];
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
  /** C3：RAG 候选数量 */
  ragCandidateCount?: number;
  /** C3：已对齐内容库的 POI 数量 */
  ragMatchedCount?: number;
}

import type { AttractionOpenHours, AttractionOpenHoursWindow } from './open-hours.js';

export type { AttractionOpenHours, AttractionOpenHoursWindow };

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
  /** H9-3：景点开放时长；无则视为全天开放 */
  openHours?: AttractionOpenHours | null;
  status: number;
  source: string;
  priceSource: string | null;
  matchConfidence: number | null;
  priceUpdatedAt: string | null;
  verifiedAt: string | null;
  /** 封面图公网 URL */
  coverImageUrl?: string | null;
  /** manual | amap | wikimedia | ugc | generated */
  imageSource?: string | null;
  imageLicense?: string | null;
  imageAttribution?: string | null;
  imageFetchedAt?: string | null;
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
  llmProvider?: 'deepseek' | 'lmstudio' | 'ai-service';
  /** AI 生成时用户输入的原始需求 */
  sourcePrompt?: string | null;
  /**
   * 列表卡片封面：优先旅程相册图，其次路线生成时的景点封面
   * （GET /routes、/routes/plaza 等列表接口填充）
   */
  listCoverImageUrl?: string | null;
}

/** 路线列表查询（GET /routes） */
export type RouteListScope = 'mine' | 'hot' | 'favorites' | 'plaza';

export type RouteListSort = 'recent' | 'hot' | 'views';

export interface RouteListQuery {
  scope?: RouteListScope;
  status?: number;
  sort?: RouteListSort;
  /** 按路线名称、简介模糊搜索（不含行程景点与 routeDetail） */
  keyword?: string;
  /** @deprecated 请使用 pageSize */
  limit?: number;
  page?: number;
  pageSize?: number;
}

/** 移动端订单列表 Tab 筛选 */
export type OrderListTab = 'all' | 'pending' | 'done';

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

/** 规划对话消息角色 */
export type PlanSessionMessageRole = 'user' | 'assistant';

/** C3：RAG 检索得到的候选景点 */
export interface RagAttractionCandidate {
  id: number;
  name: string;
  category: string;
  tags: string[];
  description: string | null;
  ticketPrice: number;
  latitude: number | null;
  longitude: number | null;
  aliases: string[];
  score: number;
}

/** H9：大交通偏好 */
export type TransportPreference = 'train' | 'flight' | 'high_speed_rail' | 'self_drive' | 'any';

/** H9：住宿档次 */
export type LodgingTier = 'budget' | 'comfort' | 'luxury' | 'any';

/** 意图解析来源 */
export type TravelIntentSource = 'rule' | 'llm' | 'hybrid';

/** C2：从用户描述中解析的结构化旅行意图 */
export interface TravelIntentSnapshot {
  /** 游玩目的地城市（非出发地） */
  city: string | null;
  days: number | null;
  /** 预算描述，如 "5000" 或 "2000-4000" */
  budget: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  themes: string[];
  confidence: 'low' | 'medium' | 'high';
  /** H9：大交通偏好（高铁/飞机/自驾等） */
  transportPreference?: TransportPreference | null;
  /** H9：住宿区域偏好，如「西湖边」 */
  lodgingArea?: string | null;
  /** H9：住宿档次 */
  lodgingTier?: LodgingTier | null;
  /** H9：多城行程城市顺序（可选） */
  cities?: string[];
  /** H9-3：出发日期 ISO（YYYY-MM-DD），用于跨城班次查询 */
  startDate?: string | null;
  /** 出发/起点城市，仅作大交通起点，禁止安排游玩 POI */
  departureCity?: string | null;
  /** 排除的省份 code（与 city-regions 对齐，如 hubei） */
  excludeProvinceCodes?: string[];
  /** 用户未指定目的地时，AI 推荐的候选目的地 */
  suggestedDestinations?: string[];
  /** 结构化约束摘要（展示与 LLM 约束块） */
  constraintSummary?: string | null;
  /** 意图解析来源 */
  intentSource?: TravelIntentSource;
}

/** 传给 LLM 的对话历史条目 */
export interface PlanChatMessage {
  role: PlanSessionMessageRole;
  content: string;
}

/** 规划会话消息 */
export interface PlanSessionMessageInfo {
  id: number;
  role: PlanSessionMessageRole;
  content: string;
  routeSnapshot?: Record<string, unknown> | null;
  createdAt: string;
}

/** C7-b：Agent Tool 调用轨迹（写入 plan_sessions.agent_state） */
export interface AgentToolTraceEntry {
  tool: string;
  ok: boolean;
  ms: number;
}

/** C7-b：规划会话 Agent 编排状态（JSON 列） */
export interface PlanSessionAgentState {
  lastRoutedIntent: string;
  /** agent = 走 runAgentPlan；pipeline = 降级或未开 flag */
  generationPath: 'agent' | 'pipeline';
  toolTrace: AgentToolTraceEntry[];
  assistantHint?: string;
}

/** 规划会话摘要（列表） */
export interface PlanSessionSummary {
  id: number;
  routeId: number | null;
  provider: LlmProviderChoice | null;
  status: number;
  title: string | null;
  messageCount: number;
  intentSnapshot?: TravelIntentSnapshot | null;
  /** C7-b：最近一次 Agent 编排状态（追问 append 后更新） */
  agentState?: PlanSessionAgentState | null;
  createdAt: string;
  updatedAt: string;
}

/** 规划会话详情 */
export interface PlanSessionInfo extends PlanSessionSummary {
  messages: PlanSessionMessageInfo[];
  route?: TravelRouteInfo | null;
  candidates?: PlanRouteCandidate[];
}

/** 创建规划会话（首条需求） */
export interface CreatePlanSessionRequest {
  prompt: string;
  days?: number;
  budget?: string;
  provider?: LlmProviderChoice;
}

/** 追问 / 调整方案 */
export interface AppendPlanMessageRequest {
  content: string;
}

/** C4：规划会话候选路线 */
export interface PlanRouteCandidate {
  id: number;
  routeId: number;
  label: string;
  variantKey: string | null;
  sortOrder: number;
  isSelected: boolean;
  route?: TravelRouteInfo | null;
}

/** 选择候选方案 */
export interface SelectPlanCandidateRequest {
  routeId: number;
}

/** 规划会话操作结果（含路线与助手回复） */
export interface PlanSessionActionResult extends TravelRouteInfo {
  sessionId: number;
  assistantMessage: string;
  intentSnapshot?: TravelIntentSnapshot | null;
  /** C3：本方案引用库内景点数 */
  ragMatchedCount?: number;
  /** C4：候选方案列表（数量随会员等级，默认 2 套） */
  candidates?: PlanRouteCandidate[];
  /** 当前会员等级可生成的候选方案数 */
  memberPlanCandidateCount?: number;
  memberLevel?: number;
  memberLevelLabel?: string;
  generationSource?: 'llm' | 'template';
  llmProvider?: 'deepseek' | 'lmstudio' | 'ai-service';
  /** C7-b：本次操作 Agent 状态（与 DB agent_state 一致） */
  agentState?: PlanSessionAgentState | null;
}

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

/** 会员变更日志 */
export interface MembershipChangeLog {
  id: number;
  userId: number;
  username?: string;
  nickname?: string;
  fromLevel: number;
  toLevel: number;
  source: string;
  remark: string | null;
  orderId: number | null;
  operatorId: number | null;
  operatorName?: string | null;
  memberExpiresAt: string | null;
  createdAt: string;
}

/** 管理端会员用户行 */
export interface AdminMembershipUserRow {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  memberLevel: number;
  effectiveLevel: number;
  memberExpiresAt: string | null;
  isExpired: boolean;
  status: number;
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

/** 旅程相册状态 */
export type JourneyAlbumStatusValue = 'active' | 'archived';

/** 旅行照片来源 */
export type TravelPhotoSourceValue = 'upload' | 'checkin' | 'import';

/** J5：EXIF 智能归类置信度 */
export type TravelPhotoPlacementConfidence = 'high' | 'medium' | 'low' | 'none';

/** J5：EXIF 归类依据 */
export type TravelPhotoPlacementReason = 'gps' | 'date' | 'gps_date' | 'none';

/** J5：上传时 EXIF 建议的 day/POI */
export interface TravelPhotoPlacementSuggestion {
  dayIndex: number | null;
  poiName: string | null;
  attractionId: number | null;
  confidence: TravelPhotoPlacementConfidence;
  reason: TravelPhotoPlacementReason;
  distanceMeters?: number | null;
}

/** 旅程相册摘要（列表项） */
export interface JourneyAlbumSummary {
  id: number;
  userId: number;
  routeId: number;
  routeName: string | null;
  title: string;
  coverPhotoId: number | null;
  coverPhotoUrl: string | null;
  photoCount: number;
  bytesUsed: number;
  status: JourneyAlbumStatusValue;
  /** J5：是否已开启公开分享 */
  shareEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 旅行照片 EXIF 拍摄参数（上传时解析） */
export interface TravelPhotoShootingParams {
  deviceMake?: string | null;
  deviceModel?: string | null;
  lensModel?: string | null;
  iso?: number | null;
  fNumber?: number | null;
  exposureTimeSec?: number | null;
  focalLengthMm?: number | null;
  focalLength35mm?: number | null;
  flash?: boolean | null;
  whiteBalance?: string | null;
}

/** 旅行照片信息 */
export interface TravelPhotoInfo {
  id: number;
  albumId: number;
  storedUrl: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  dayIndex: number | null;
  poiName: string | null;
  attractionId: number | null;
  checkInId: number | null;
  takenAt: string | null;
  latitude: number | null;
  longitude: number | null;
  caption: string | null;
  sortOrder: number;
  source: TravelPhotoSourceValue;
  createdAt: string;
  /** J5：上传响应可附带 EXIF 归类建议 */
  placementSuggestion?: TravelPhotoPlacementSuggestion | null;
  /** 拍摄参数（EXIF，上传时写入） */
  shootingParams?: TravelPhotoShootingParams | null;
}

/** 相册内按天/POI 分组 */
export interface JourneyAlbumPhotoGroup {
  dayIndex: number | null;
  poiName: string | null;
  attractionId: number | null;
  photos: TravelPhotoInfo[];
}

/** 旅程相册详情 */
export interface JourneyAlbumDetail extends JourneyAlbumSummary {
  groups: JourneyAlbumPhotoGroup[];
  photos: TravelPhotoInfo[];
}

/** 创建旅程相册 */
export interface CreateJourneyAlbumRequest {
  routeId: number;
  title?: string;
}

/** 更新旅行照片元数据 */
export interface UpdateTravelPhotoRequest {
  dayIndex?: number | null;
  poiName?: string | null;
  attractionId?: number | null;
  caption?: string | null;
  sortOrder?: number;
}

/** 用户照片存储用量（GET /users/me/storage） */
export interface UserPhotoStorageInfo {
  level: number;
  usedBytes: number;
  maxBytes: number;
  usedCount: number;
  maxCount: number;
  maxFileBytes: number;
}

/** 用户全站旅行照片列表项（GET /journey-albums/photos） */
export interface UserTravelPhotoListItem extends TravelPhotoInfo {
  albumTitle: string;
  routeId: number;
  routeName: string | null;
}

/** J5：更新相册分享开关 */
export interface UpdateJourneyAlbumShareRequest {
  enabled: boolean;
}

export interface JourneyAlbumShareState {
  shareEnabled: boolean;
  shareToken: string | null;
  /** 客户端拼接 H5/PC 分享路径，如 `/share/journey-albums/{token}` */
  sharePath: string | null;
}

/** J5：公开分享的旅程相册（只读） */
export interface SharedJourneyAlbumPayload {
  title: string;
  routeName: string | null;
  photoCount: number;
  coverPhotoUrl: string | null;
  photos: TravelPhotoInfo[];
  groups: JourneyAlbumPhotoGroup[];
}

/** J5：批量应用 EXIF 建议结果 */
export interface ApplyExifSuggestionsResult {
  applied: number;
  skipped: number;
  photos: TravelPhotoInfo[];
}

/** 数据分析概览 */
export interface AnalyticsOverview {
  users: {
    total: number;
    newToday: number;
    newLast7Days: number;
  };
  routes: {
    total: number;
    publicTotal: number;
    newLast7Days: number;
  };
  orders: {
    total: number;
    paidTotal: number;
    newLast7Days: number;
  };
  checkins: {
    total: number;
    approvedTotal: number;
    newLast7Days: number;
  };
  planSessions: {
    total: number;
    newLast7Days: number;
  };
  generatedAt: string;
}

/** 按日趋势数据点 */
export interface AnalyticsDailyPoint {
  date: string;
  users: number;
  routes: number;
  orders: number;
  checkins: number;
  planSessions: number;
}

/** 打卡城市排行项 */
export interface AnalyticsCityRankItem {
  cityCode: string;
  checkinCount: number;
}

/** 写入埋点事件 */
export interface TrackAnalyticsEventInput {
  eventName: string;
  eventCategory?: string;
  userId?: number;
  sessionId?: string;
  properties?: Record<string, unknown>;
  source?: string;
  occurredAt?: Date;
}
