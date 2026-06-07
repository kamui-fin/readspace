import { ApiClient } from "../core";
import type { UserProfile, UserLimits } from "../types/users";

export const users = {
  getProfile: () => ApiClient.get<UserProfile>("/api/users/profile"),
  getLimits: () => ApiClient.get<UserLimits>("/api/users/limits"),
};
