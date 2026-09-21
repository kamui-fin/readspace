import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';
import { ApiClient } from '../client';
import { queryKeys, RSS_QUERY_KEYS } from '../query-keys';
import type {
  UserProfile,
  UserLimits,
  ProfileUpdate,
  DowngradeResolveRequest,
  DowngradeResolveResponse,
} from '../types/users';

export function useProfile(
  options?: Omit<
    UseQueryOptions<UserProfile, Error, UserProfile, ReturnType<typeof queryKeys.userProfile>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: () => ApiClient.getProfile(),
    ...options,
  });
}

export function useUpdateProfile(options?: UseMutationOptions<UserProfile, Error, ProfileUpdate>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfileUpdate) => ApiClient.updateProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.userProfile(), data);
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile() });
    },
    ...options,
  });
}

export function useDeleteAccount(options?: UseMutationOptions<void, Error, void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ApiClient.deleteAccount(),
    onSuccess: () => {
      queryClient.clear();
    },
    ...options,
  });
}

export function useUserLimits(
  options?: Omit<
    UseQueryOptions<UserLimits, Error, UserLimits, ReturnType<typeof queryKeys.userLimits>>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.userLimits(),
    queryFn: () => ApiClient.getLimits(),
    ...options,
  });
}

/**
 * Keep the chosen feeds after a plan downgrade; the server unsubscribes from everything else
 * (and all newsletters on Free). Invalidates everything a subscription change touches, plus
 * limits so the downgrade gate lifts only once the cache reflects the new state.
 */
export function useResolveDowngrade(
  options?: UseMutationOptions<DowngradeResolveResponse, Error, DowngradeResolveRequest>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: DowngradeResolveRequest) => ApiClient.resolveDowngrade(data),
    // Lift the downgrade gate from the server's own post-resolve answer rather than waiting on
    // the limits refetch below, which could otherwise leave the flow on screen.
    onSuccess: (data) => {
      queryClient.setQueryData<UserLimits>(queryKeys.userLimits(), (old) =>
        old ? { ...old, over_limit: data.over_limit } : old
      );
    },
    onSettled: () => {
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.userLimits() }),
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.FEEDS] }),
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.ARTICLES] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.unreadCounts() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.feedUnreadCounts() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.folders() }),
        queryClient.invalidateQueries({ queryKey: [RSS_QUERY_KEYS.SIDEBAR_DATA] }),
      ]);
    },
    ...options,
  });
}
