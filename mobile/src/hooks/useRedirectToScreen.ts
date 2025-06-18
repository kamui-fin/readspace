import { useRouter } from "expo-router";

export const useRedirectToScreen = () => {
	const router = useRouter();

	return ({ redirectedCallback }: { redirectedCallback?: () => void }) => {
		// Redirect to auth screen
		router.replace("/auth" as any);

		// Store the callback for after authentication
		if (redirectedCallback) {
			// You could store this in state management or async storage
			// For now, we'll just log it
			console.log("Redirect callback stored:", redirectedCallback);
		}
	};
};
