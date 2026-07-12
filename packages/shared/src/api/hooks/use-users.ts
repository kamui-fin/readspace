import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query';
import { ApiClient } from '../client';
import { queryKeys } from '../query-keys';
import type { UserProfile, UserLimits, ProfileUpdate } from '../types/users';

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

export function useUpdateProfile(
  options?: UseMutationOptions<UserProfile, Error, ProfileUpdate>
) {
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

