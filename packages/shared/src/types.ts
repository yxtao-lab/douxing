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
