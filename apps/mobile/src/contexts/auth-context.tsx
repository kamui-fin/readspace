import type { Session, User } from '@supabase/supabase-js';
import type React from 'react';
import { createContext, use, useEffect, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';

import { supabase } from '@lib/supabase/client';
import { useStorageState } from '@hooks/useStorageState';
import { configureApiClient } from '@lib/api/config';

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
  signOut: () => Promise<void>;
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signUp: (credentials: SignUpCredentials) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => {},
  signIn: async () => {},
  signUp: async () => {},
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
  const [[isLoading, storedSession], setStoredSession] = useStorageState('session');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Store session token for persistence check
        if (currentSession) {
          setStoredSession(currentSession.access_token);
        }

        // Configure API client after getting initial session
        configureApiClient();
      } catch (error) {
        console.error('Error getting session:', error);
      }
    };

    getSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('Auth state changed:', event);
      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Update stored session
      if (newSession) {
        setStoredSession(newSession.access_token);
      } else {
        setStoredSession(null);
      }

      // Reconfigure API client when session changes
      configureApiClient();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setStoredSession]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProtectedGroup = segments[0] === '(protected)';

    if (!session && inProtectedGroup) {
      // Redirect to auth if not authenticated
      router.replace('/(auth)');
    } else if (session && inAuthGroup) {
      // Redirect to protected route if authenticated
      router.replace('/(protected)');
    }
  }, [
    session,
    segments,
    isLoading, // Redirect to protected route if authenticated
    router.replace,
  ]);

  const signIn = async (credentials: SignInCredentials) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signUp = async (credentials: SignUpCredentials) => {
    const { error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!session,
    isLoading,
    signOut,
    signIn,
    signUp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
