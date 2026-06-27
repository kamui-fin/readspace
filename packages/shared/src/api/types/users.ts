export enum UserRole {
  BASIC = 'BASIC',
  PRO = 'PRO',
  ADMIN = 'ADMIN',
}

export interface ProfileResponse {
  id: string;
  email: string;
  role: UserRole;
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

// Alias for backward compatibility if needed, though ProfileResponse is preferred
export type User = ProfileResponse;
export type UserProfile = ProfileResponse;

export interface ProfileUpdate {
  email?: string;
  is_onboarded?: boolean;
}

export interface TokenData {
  sub: string;
  email?: string;
  role?: string;
}

export interface UserLimits {
  role: UserRole;
  limits: {
    max_subscriptions: number;
    max_daily_ai_calls: number;
    semantic_search: boolean;
    read_later_retention_days: number;
  };
  usage: {
    subscriptions: number;
    daily_ai_calls: number;
  };
}
