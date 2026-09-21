import { ApiClient } from '../core';
import type {
  UserProfile,
  UserLimits,
  ProfileUpdate,
  DowngradeResolveRequest,
  DowngradeResolveResponse,
} from '../types/users';

export const users = {
  getProfile: () => ApiClient.get<UserProfile>('/api/users/profile'),
  getLimits: () => ApiClient.get<UserLimits>('/api/users/limits'),
  updateProfile: (data: ProfileUpdate) => ApiClient.patch<UserProfile>('/api/users/profile', data),
  deleteAccount: () => ApiClient.delete<void>('/api/users/account'),
  resolveDowngrade: (data: DowngradeResolveRequest) =>
    ApiClient.post<DowngradeResolveResponse>('/api/users/downgrade/resolve', data),
};
