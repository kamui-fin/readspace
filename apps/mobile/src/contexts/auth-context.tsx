
import { configureApiClient } from '@lib/api-client';
import { supabase } from '@lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import type React from 'react';
import { createContext, use, useEffect, useState } from 'react';

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
  signInWithGoogle: (idToken: string, accessToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
  signOut: async () => { },
  signIn: async () => { },
  signUp: async () => { },
  signInWithGoogle: async () => { },
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
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    console.log('[AuthContext] 🚀 Starting initialization...');

    supabase.auth.getSession().then(({ data: { session: currentSession }, error }) => {
      console.log('[AuthContext] 📦 getSession resolved. hasSession:', !!currentSession, 'error:', error?.message);
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      configureApiClient();
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      console.log('[AuthContext] 🔄 onAuthStateChange:', _event, 'hasSession:', !!newSession);
      // Don't update state on INITIAL_SESSION as getSession handles the initial load
      if (_event === 'INITIAL_SESSION') return;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      configureApiClient();
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Note: We deliberately removed the strict manual redirection effect here.
  // The app's routing is controlled entirely by `app/index.tsx` on initialization, 
  // and by Expo Router's automatic segmented hierarchy rendering during the session.

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

  const signInWithGoogle = async (idToken: string, accessToken: string) => {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: accessToken,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Note: The onAuthStateChange listener will handle session updates
    // We don't need to manually set session here as it will be set by the listener
    // This ensures proper navigation flow through the auth state change effect
  };

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!session,
    isLoading,
    signOut,
    signIn,
    signUp,
    signInWithGoogle,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
