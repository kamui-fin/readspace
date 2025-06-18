import type { Session, User } from "@supabase/supabase-js";

export interface Profile {
	id: string;
	name: string;
	username: string;
	img_url: string;
	default_created_sort_id: number;
	default_owned_sort_id: number;
	notifications_last_opened: Date;
	has_social_login: boolean;
}

export interface AuthContextType {
	user: User | null;
	session: Session | null;
	profile: Profile | null;
	signIn: (email: string, password: string) => Promise<void>;
	signUp: (email: string, password: string, username: string) => Promise<void>;
	signOut: () => Promise<void>;
	isLoading: boolean;
	isAuthenticated: boolean;
	error: Error | null;
}
