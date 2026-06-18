/** H3-a：旅行宠物物种与人格（MVP） */
export const TRAVEL_PET_SPECIES = ['fox', 'cat', 'panda'] as const;
export type TravelPetSpecies = (typeof TRAVEL_PET_SPECIES)[number];

export const TRAVEL_PET_PERSONALITIES = ['guide', 'foodie', 'photo', 'family'] as const;
export type TravelPetPersonality = (typeof TRAVEL_PET_PERSONALITIES)[number];

export const TRAVEL_PET_MOODS = ['happy', 'calm', 'excited', 'sleepy'] as const;
export type TravelPetMood = (typeof TRAVEL_PET_MOODS)[number];

/** 系统懒创建时的默认昵称（与 ensureTravelPet 一致） */
export const TRAVEL_PET_DEFAULT_NICKNAME = '小兜';

export interface TravelPetInfo {
  id: number;
  species: TravelPetSpecies;
  nickname: string;
  personality: TravelPetPersonality;
  level: number;
  exp: number;
  mood: TravelPetMood;
  createdAt: string;
  updatedAt: string;
}

export interface AdoptTravelPetRequest {
  species: TravelPetSpecies;
  nickname: string;
  personality: TravelPetPersonality;
}

export interface UpdateTravelPetRequest {
  nickname?: string;
  personality?: TravelPetPersonality;
}

export function isTravelPetSpecies(value: string): value is TravelPetSpecies {
  return (TRAVEL_PET_SPECIES as readonly string[]).includes(value);
}

export function isTravelPetPersonality(value: string): value is TravelPetPersonality {
  return (TRAVEL_PET_PERSONALITIES as readonly string[]).includes(value);
}
