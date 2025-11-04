import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useSettingsStore } from '@/stores/settings';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Linking from 'expo-linking';

interface SignUpCredentials {
    email: string;
    password: string;
}

interface SignInCredentials {
    email: string;
    password: string;
}

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isAuthenticated: boolean;
    loading: boolean;
    needsOnboarding: boolean | null;
    signOut: () => Promise<void>;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
    checkOnboardingStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
    const settings = useSettingsStore((state) => state.settings);

    const isAuthenticated = !!session;

    // Handle deep linking for email verification
    useEffect(() => {
        const handleDeepLink = async (url: string) => {
            console.log('[AuthProvider] Handling deep link:', url);

            const parsed = Linking.parse(url);
            const { access_token, refresh_token, error: errorParam } = parsed.queryParams || {};

            if (errorParam) {
                console.error('[AuthProvider] Deep link error:', errorParam);
                return;
            }

            if (access_token && refresh_token) {
                console.log('[AuthProvider] Setting session from deep link');
                const supabase = getSupabaseClient();
                const { error } = await supabase.auth.setSession({
                    access_token: access_token as string,
                    refresh_token: refresh_token as string,
                });

                if (error) {
                    console.error('[AuthProvider] Error setting session from deep link:', error);
                }
            }
        };

        // Handle initial URL if app was opened from a link
        Linking.getInitialURL().then((url) => {
            if (url) {
                handleDeepLink(url);
            }
        });

        // Handle URLs while app is running
        const subscription = Linking.addEventListener('url', ({ url }) => {
            handleDeepLink(url);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Reconfigure clients when settings change (but NOT during initial load)
    useEffect(() => {
        // Skip on initial mount - only run when settings actually change
        if (loading) {
            console.log('[AuthProvider] Skipping settings change during initial load');
            return;
        }

        console.log('[AuthProvider] Settings changed, reconfiguring clients');

        // Lazy imports to avoid circular dependencies
        const { resetSupabaseClient } = require('@/lib/supabase/client');
        const { configureApiClient } = require('@/lib/api/config');

        resetSupabaseClient();
        configureApiClient();

        // If user was authenticated, clear their session to force re-auth
        if (session) {
            console.log('[AuthProvider] Clearing session due to settings change');
            setSession(null);
            setUser(null);
        }
    }, [settings.instance_type, settings.readspace_url, settings.supabase_url]);

    useEffect(() => {
        console.log(
            '[AuthProvider] Setting up auth subscription for instance:',
            settings.instance_type
        );

        const getSession = async () => {
            try {
                const supabase = getSupabaseClient();
                console.log('[AuthProvider] Getting initial session');
                const {
                    data: { session: currentSession },
                } = await supabase.auth.getSession();
                console.log('[AuthProvider] Initial session:', currentSession ? 'exists' : 'none');
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
            } catch (error) {
                console.error('[AuthProvider] Error in getSession:', error);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        const supabase = getSupabaseClient();
        console.log('[AuthProvider] Subscribing to auth state changes');
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            console.log('[AuthProvider] Auth state changed:', event, newSession?.user?.email);
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setLoading(false);
        });

        return () => {
            console.log('[AuthProvider] Unsubscribing from auth state changes');
            subscription.unsubscribe();
        };
    }, [settings.instance_type, settings.supabase_url]);

    const signIn = async (credentials: SignInCredentials) => {
        console.log('[AuthProvider] Attempting sign in for:', credentials.email);
        console.log('[AuthProvider] Current settings:', {
            instance_type: settings.instance_type,
            readspace_url: settings.readspace_url,
            supabase_url: settings.supabase_url,
            supabase_anon_key: settings.supabase_anon_key.substring(0, 50) + '...',
        });

        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });

        if (error) {
            console.error('[AuthProvider] Sign in error:', error);
            throw new Error(error.message);
        }

        console.log('[AuthProvider] Sign in successful');
    };

    const signUp = async (credentials: SignUpCredentials) => {
        console.log('Attempting to sign up with:', credentials.email);
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signUp({
            email: credentials.email,
            password: credentials.password,
        });

        if (error) {
            console.error('Sign-up error:', error.message);
            throw new Error(error.message);
        }
        console.log('Sign-up successful for:', credentials.email);
    };

    const signOut = async () => {
        try {
            console.log('[AuthProvider] Signing out');

            // Sign out from Google if user is signed in with Google
            try {
                const googleUser = await GoogleSignin.getCurrentUser();
                if (googleUser !== null) {
                    console.log('[AuthProvider] Signing out from Google');
                    await GoogleSignin.signOut();
                }
            } catch (googleError) {
                console.error('[AuthProvider] Error signing out from Google:', googleError);
                // Continue with Supabase sign out even if Google sign out fails
            }

            // Sign out from Supabase
            const supabase = getSupabaseClient();
            await supabase.auth.signOut();

            console.log('[AuthProvider] Sign out successful');
        } catch (error) {
            console.error('[AuthProvider] Error signing out:', error);
            throw error;
        }
    };

    const checkOnboardingStatus = async () => {
        if (!user) {
            console.log('[AuthProvider] No user, resetting onboarding status');
            setNeedsOnboarding(null);
            return;
        }

        try {
            console.log('[AuthProvider] Checking onboarding status for user:', user.id);
            const supabase = getSupabaseClient();
            const { data: subscriptions, error } = await supabase
                .from('feed_subscriptions')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

            if (error) {
                console.error('[AuthProvider] Error checking feed subscriptions:', error);
                // Default to not needing onboarding on error to avoid blocking users
                setNeedsOnboarding(false);
                return;
            }

            const needsOnboarding = !subscriptions || subscriptions.length === 0;
            console.log('[AuthProvider] Onboarding status:', {
                subscriptionCount: subscriptions?.length ?? 0,
                needsOnboarding,
            });
            setNeedsOnboarding(needsOnboarding);
        } catch (error) {
            console.error('[AuthProvider] Error in checkOnboardingStatus:', error);
            // Default to not needing onboarding on error
            setNeedsOnboarding(false);
        }
    };

    // Check onboarding status when user changes
    useEffect(() => {
        if (user) {
            checkOnboardingStatus();
        } else {
            setNeedsOnboarding(null);
        }
    }, [user?.id]);

    const value: AuthContextType = {
        user,
        session,
        isAuthenticated,
        loading,
        needsOnboarding,
        signOut,
        signIn,
        signUp,
        checkOnboardingStatus,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Component that handles query cache clearing - must be inside QueryClientProvider
export function AuthQueryManager() {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const hasInitializedRef = useRef(false);

    useEffect(() => {
        const supabase = getSupabaseClient();
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            const previousUserId = user?.id;
            const newUserId = newSession?.user?.id;

            // Skip cache clearing on initial session restore
            if (event === 'INITIAL_SESSION') {
                hasInitializedRef.current = true;
                return;
            }

            // Clear query cache when user changes or signs out
            if (
                event === 'SIGNED_OUT' ||
                (previousUserId && newUserId && previousUserId !== newUserId)
            ) {
                console.log('🧹 Clearing query cache due to user change/sign out');
                queryClient.clear();
            }

            // Only clear cache for SIGNED_IN if we've already initialized (not on app launch)
            if (
                event === 'SIGNED_IN' &&
                hasInitializedRef.current &&
                !previousUserId &&
                newUserId
            ) {
                console.log('🧹 Clearing query cache for fresh sign in');
                queryClient.clear();
            }
        });

        return () => subscription.unsubscribe();
    }, [user?.id, queryClient]);

    return null; // This component doesn't render anything
}
