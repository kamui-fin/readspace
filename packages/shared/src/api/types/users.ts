import type { CodexAllowance, CodexUsage } from './codex';

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
    max_daily_scrapes: number;
    semantic_search: boolean;
    /** Max saved (read-later) articles held at once; -1 = unlimited. */
    max_saved_articles: number;
    /** Codex allowance for this role — {} for Admin (unlimited). */
    codex?: CodexAllowance;
  };
  usage: {
    subscriptions: number;
    saved_articles: number;
    newsletters: number;
    daily_ai_calls: number;
    daily_scrapes: number;
    /** Codex usage — { unlimited: true } for Admin, else { period, limit, used }. */
    codex?: CodexUsage;
  };
  over_limit: OverLimitState;
}

export interface OverLimitResource {
  usage: number;
  /** -1 = unlimited */
  limit: number;
  over: boolean;
}

/**
 * What the user holds beyond their plan, typically after a Pro -> Basic downgrade.
 * `downgrade_required` gates Basic users until they pick feeds to keep. Paid users retain
 * access to existing holdings above new caps; limits still apply to new subscriptions.
 * Excess saved articles are informational: they're kept, but new saves stay blocked.
 */
export interface OverLimitState {
  downgrade_required: boolean;
  subscriptions: OverLimitResource;
  newsletters: OverLimitResource;
  saved_articles: OverLimitResource;
}

export interface DowngradeResolveRequest {
  keep_feed_ids: string[];
}

export interface DowngradeResolveResponse {
  kept_count: number;
  removed_feed_count: number;
  removed_newsletter_count: number;
  /** Holdings vs. limits after the change; written straight into the limits cache. */
  over_limit: OverLimitState;
}
