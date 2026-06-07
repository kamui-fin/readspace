import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { ApiClient } from "../client";
import { queryKeys } from "../query-keys";
import type { UserProfile, UserLimits } from "../types/users";

export function useProfile(
  options?: Omit<
    UseQueryOptions<
      UserProfile,
      Error,
      UserProfile,
      ReturnType<typeof queryKeys.userProfile>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.userProfile(),
    queryFn: () => ApiClient.getProfile(),
    ...options,
  });
}

export function useUserLimits(
  options?: Omit<
    UseQueryOptions<
      UserLimits,
      Error,
      UserLimits,
      ReturnType<typeof queryKeys.userLimits>
    >,
    "queryKey" | "queryFn"
  >,
) {
  return useQuery({
    queryKey: queryKeys.userLimits(),
    queryFn: () => ApiClient.getLimits(),
    ...options,
  });
}
