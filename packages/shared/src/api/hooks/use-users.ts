import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { ApiClient } from "../client";
import { queryKeys } from "../query-keys";
import type { UserProfile } from "../endpoints/users";

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
