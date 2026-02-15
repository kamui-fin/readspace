import { ApiClient } from "../core";

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

export const users = {
  getProfile: () => ApiClient.get<UserProfile>("/api/users/profile"),
};
