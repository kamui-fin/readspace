import React, { useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@lib/supabase/client";
import type { AuthContextType, Profile } from "@/src/types";
import { AuthContext } from "@context/user-context";

interface AuthProviderProps {
	children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
	const [user, setUser] = useState<User | null>(null);
	const [session, setSession] = useState<Session | null>(null);
	const [profile, setProfile] = useState<Profile | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const isAuthenticated = !!user && !!session;

	useEffect(() => {
		let mounted = true;

		// Get initial session
		const getInitialSession = async () => {
			try {
				console.log("AuthProvider: Getting initial session...");
				const {
					data: { session },
					error,
				} = await supabase.auth.getSession();

				if (error) {
					console.error("AuthProvider: Error getting session:", error);
					throw error;
				}

				if (!mounted) return;

				console.log(
					"AuthProvider: Initial session:",
					session ? "Found" : "None",
				);
				setSession(session);
				setUser(session?.user ?? null);

				if (session?.user) {
					await fetchUserProfile(session.user.id);
				}
			} catch (err) {
				console.error("AuthProvider: Error in getInitialSession:", err);
				if (mounted) {
					setError(err as Error);
				}
			} finally {
				if (mounted) {
					console.log("AuthProvider: Initial auth check complete");
					setIsLoading(false);
				}
			}
		};

		getInitialSession();

		// Listen for auth changes
		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log(
				"AuthProvider: Auth state changed:",
				event,
				session ? "Session exists" : "No session",
			);

			if (!mounted) return;

			setSession(session);
			setUser(session?.user ?? null);

			if (session?.user) {
				await fetchUserProfile(session.user.id);
			} else {
				setProfile(null);
			}

			setIsLoading(false);
		});

		return () => {
			mounted = false;
			subscription.unsubscribe();
		};
	}, []);

	const fetchUserProfile = async (userId: string) => {
		try {
			console.log("AuthProvider: Fetching profile for user:", userId);
			// This assumes you have a profiles table in your Supabase database
			// Adjust the query based on your actual database schema
			const { data, error } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", userId)
				.single();

			if (error && error.code !== "PGRST116") {
				// PGRST116 means no rows returned, which is fine for new users
				console.warn("AuthProvider: Profile fetch error:", error);
				throw error;
			}

			console.log("AuthProvider: Profile fetched:", data ? "Found" : "None");
			setProfile(data);
		} catch (err) {
			console.error("Error fetching profile:", err);
			// Don't set this as a critical error since profile might not exist yet
		}
	};

	const signIn = async (email: string, password: string) => {
		try {
			console.log("AuthProvider: Signing in user...");
			setError(null);
			setIsLoading(true);

			const { error } = await supabase.auth.signInWithPassword({
				email,
				password,
			});

			if (error) {
				console.error("AuthProvider: Sign in error:", error);
				throw error;
			}

			console.log("AuthProvider: Sign in successful");
		} catch (err) {
			console.error("AuthProvider: Sign in failed:", err);
			setError(err as Error);
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const signUp = async (email: string, password: string, username: string) => {
		try {
			console.log("AuthProvider: Signing up user...");
			setError(null);
			setIsLoading(true);

			const {
				data: { user },
				error,
			} = await supabase.auth.signUp({
				email,
				password,
				options: {
					data: {
						username,
					},
				},
			});

			if (error) {
				console.error("AuthProvider: Sign up error:", error);
				throw error;
			}

			if (!user) {
				throw new Error("AuthProvider: Sign up successful, but no user found.");
			}

			console.log("AuthProvider: User created, inserting profile...");

			const { error: profileError } = await supabase.from("profiles").insert({
				id: user.id,
				name: username,
				username,
				img_url: `https://api.dicebear.com/8.x/pixel-art/png?seed=${username}`,
				// Set default values for other fields
				default_created_sort_id: 1,
				default_owned_sort_id: 1,
				notifications_last_opened: new Date(),
				has_verified_phone_number: false,
				captcha_completed_at: null,
				has_social_login: false,
			});

			if (profileError) {
				console.error("AuthProvider: Profile insert error:", profileError);
				throw profileError;
			}

			console.log("AuthProvider: Sign up and profile creation successful");
		} catch (err) {
			console.error("AuthProvider: Sign up failed:", err);
			setError(err as Error);
			throw err;
		} finally {
			setIsLoading(false);
		}
	};

	const signOut = async () => {
		try {
			console.log("AuthProvider: Signing out user...");
			setError(null);
			const { error } = await supabase.auth.signOut();
			if (error) {
				console.error("AuthProvider: Sign out error:", error);
				throw error;
			}
			console.log("AuthProvider: Sign out successful");
		} catch (err) {
			console.error("AuthProvider: Sign out failed:", err);
			setError(err as Error);
			throw err;
		}
	};

	const value: AuthContextType = {
		user,
		session,
		profile,
		signIn,
		signUp,
		signOut,
		isLoading,
		isAuthenticated,
		error,
	};

	console.log("AuthProvider: Rendering with state:", {
		isLoading,
		isAuthenticated,
		hasUser: !!user,
		hasError: !!error,
	});

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
