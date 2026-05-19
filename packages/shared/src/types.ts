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
  status: number;
  roles: string[];
}

export interface LoginResult {
  token: string;
  user: UserInfo;
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
  isAiGenerated?: boolean;
  unlockPrice?: number;
  isUnlocked?: boolean;
  generationSource?: 'llm' | 'template';
}

export interface LlmStatusInfo {
  enabled: boolean;
  available: boolean;
  baseUrl: string;
  model: string;
  error?: string;
  message?: string;
}

export interface GenerateRouteRequest {
  prompt: string;
  days?: number;
  budget?: string;
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

export interface CheckInResult {
  checkIn: CheckInInfo;
  newAchievements: AchievementInfo[];
}

export interface CheckInInfo {
  id: number;
  userId: number;
  routeId: number;
  location: {
    latitude?: number;
    longitude?: number;
    address?: string;
    placeName?: string;
  };
  checkedAt: string;
  status: number;
  remark: string | null;
}

export interface AchievementInfo {
  id: number;
  userId: number;
  achievementType: string;
  unlockedAt: string;
  description: string | null;
}
