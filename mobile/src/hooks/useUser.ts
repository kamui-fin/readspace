import { useAuth } from "@/src/context/user-context";

export const useUser = () => {
	const { user, isAuthenticated, isLoading, error, profile } = useAuth();

	return {
		user,
		isAuthenticated,
		isLoading,
		error,
		profile,
		// Legacy compatibility
		isIncompletedProfile: !profile && isAuthenticated,
	};
};
