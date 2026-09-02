import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureApiClient } from '@lib/api-client';
import { supabase } from '@lib/supabase/client';
import { ApiClient } from '@readspace/shared';
import { useFeedSwitcherStore } from '@stores/feed-switcher';
import { useFeedViewStore } from '@stores/feed-view';
import { useFollowingStore } from '@stores/following';
import { useOnboardingStore } from '@stores/onboarding';
import { useSearchHistory } from '@stores/search-history';
import { useSettingsStore } from '@stores/settings';
import type { Session, User } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import type React from 'react';
import { createContext, use, useEffect, useRef, useState } from 'react';

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
  isLoading: boolean;
  isNewSignup: boolean;
  isOnboarded: boolean | null;
  setIsOnboarded: (value: boolean) => void;
  signOut: () => Promise<void>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (
    credentials: SignUpCredentials
  ) => Promise<{ user: User | null; session: Session | null }>;
  signInWithGoogle: (idToken: string, accessToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  isNewSignup: false,
  isOnboarded: null,
  setIsOnboarded: () => {},
  signOut: async () => {},
  signIn: async () => {},
  signUp: async () => ({ user: null, session: null }),
  signInWithGoogle: async () => {},
});

export function useSession() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useSession must be wrapped in a <SessionProvider />');
  }
  return value;
}

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewSignup, setIsNewSignup] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();
  const isInAuthGroup = segments?.[0] === '(auth)';

  const isInitializing = useRef(true);

  const currentInstanceType = useSettingsStore((state) => state.settings.instance_type);

  useEffect(() => {
    console.log('[AuthContext] 🚀 Starting initialization...');

    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();
        console.log(
          '[AuthContext] 📦 getSession resolved. hasSession:',
          !!currentSession,
          'error:',
          error?.message
        );
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        configureApiClient();

        if (currentSession) {
          try {
            const profile = await ApiClient.get<{ is_onboarded: boolean }>('/api/users/profile');
            setIsOnboarded(profile.is_onboarded);
          } catch (e) {
            console.warn('[AuthContext] Could not fetch profile on cold start:', e);
            // Default to onboarded on error so user isn't stuck in onboarding loop
            setIsOnboarded(true);
          }
        } else {
          setIsOnboarded(true);
        }
      } catch (err) {
        console.error('[AuthContext] Error during getSession init:', err);
        setIsOnboarded(true);
      } finally {
        setIsLoading(false);
        isInitializing.current = false;
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('[AuthContext] 🔄 onAuthStateChange:', _event, 'hasSession:', !!newSession);
      if (_event === 'INITIAL_SESSION') return;

      if (_event === 'SIGNED_OUT') {
        console.log('[AuthContext] 🧹 User signed out. Clearing local stores...');
        useFeedViewStore.getState().reset();
        useFollowingStore.getState().reset();
        useFeedSwitcherStore.getState().setExpandedFolders(new Set());
        useOnboardingStore.getState().resetOnboarding();
        useSearchHistory.getState().clearHistory();
        setSession(null);
        setUser(null);
        setIsOnboarded(true);
        setIsLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      configureApiClient();

      // For OAuth sign-ins (Google), check is_onboarded from the server
      // to detect first-time users who haven't been through onboarding
      if (_event === 'SIGNED_IN' && newSession) {
        // If we are still initializing (cold start), let initializeAuth handle the profile check.
        if (isInitializing.current) {
          return;
        }

        setIsLoading(true);
        ApiClient.get<{ is_onboarded: boolean }>('/api/users/profile')
          .then((profile) => {
            setIsOnboarded(profile.is_onboarded);
          })
          .catch((e) => {
            console.warn('[AuthContext] Could not fetch profile for onboarding check:', e);
            setIsOnboarded(true);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        // For other events (e.g. token refreshed) during active sessions, don't set loading to true
        if (!isInitializing.current) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [currentInstanceType]);

  // Handle explicit navigation after session state changes
  // This ensures the router properly transitions out of (auth) routes
  useEffect(() => {
    if (isLoading) return;

    if (session && isInAuthGroup) {
      console.log('[AuthContext] 🔀 Session detected while in (auth) group, navigating to root');
      router.replace('/');
    } else if (!session && !isInAuthGroup) {
      console.log('[AuthContext] 🔀 Session cleared while in protected route, navigating to auth');
      router.replace('/(auth)');
    }
  }, [session, isInAuthGroup, isLoading, router]);

  const signIn = async (credentials: SignInCredentials) => {
    setIsNewSignup(false);
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signUp = async (credentials: SignUpCredentials) => {
    setIsNewSignup(true);
    setIsOnboarded(false);
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      setIsNewSignup(false);
      setIsOnboarded(null);
      throw new Error(error.message);
    }

    return data;
  };

  const signOut = async () => {
    setIsNewSignup(false);
    await supabase.auth.signOut({ scope: 'local' });
    // Also clear all possible session keys from AsyncStorage to prevent session leakage
    try {
      await AsyncStorage.multiRemove([
        'supabase-auth-cloud',
        'supabase-auth-self-hosted',
        'supabase-auth-validation',
      ]);
      console.log('[AuthContext] Cleared all session keys from AsyncStorage');
    } catch (e) {
      console.error('[AuthContext] Error clearing session keys:', e);
    }
  };

  const signInWithGoogle = async (idToken: string, accessToken: string) => {
    // Don't set isNewSignup here — we'll determine it from the server profile
    // after onAuthStateChange fires with SIGNED_IN event
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: accessToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Note: The onAuthStateChange listener will handle session updates and
    // check is_onboarded to determine if onboarding should be triggered
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!session,
    isLoading,
    isNewSignup,
    isOnboarded,
    setIsOnboarded,
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
