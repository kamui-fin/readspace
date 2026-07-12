import { configureApiClient } from '@lib/api-client';
import { supabase } from '@lib/supabase/client';
import { ApiClient } from '@readspace/shared';
import { useFeedSwitcherStore } from '@stores/feed-switcher';
import { useFeedViewStore } from '@stores/feed-view';
import { useFollowingStore } from '@stores/following';
import { useOnboardingStore } from '@stores/onboarding';
import { useSearchHistory } from '@stores/search-history';
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
  const router = useRouter();
  const segments = useSegments();

  const isInitializing = useRef(true);

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
            // if (!profile.is_onboarded) {
            //   setIsNewSignup(true);
            // }
          } catch (e) {
            console.warn('[AuthContext] Could not fetch profile on cold start:', e);
          }
        }
      } catch (err) {
        console.error('[AuthContext] Error during getSession init:', err);
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
            if (!profile.is_onboarded) {
              setIsNewSignup(true);
            }
          })
          .catch((e) => {
            console.warn('[AuthContext] Could not fetch profile for onboarding check:', e);
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
  }, []);

  // Note: We deliberately removed the strict manual redirection effect here.
  // The app's routing is controlled entirely by `app/index.tsx` on initialization,
  // and by Expo Router's automatic segmented hierarchy rendering during the session.

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
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      setIsNewSignup(false);
      throw new Error(error.message);
    }

    return data;
  };

  const signOut = async () => {
    setIsNewSignup(false);
    await supabase.auth.signOut({ scope: 'local' });
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
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
