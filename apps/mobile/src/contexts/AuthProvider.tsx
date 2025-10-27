import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

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
    signOut: () => Promise<void>;
    signIn: (credentials: SignInCredentials) => Promise<void>;
    signUp: (credentials: SignUpCredentials) => Promise<void>;
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

    const isAuthenticated = !!session;

    useEffect(() => {
        const getSession = async () => {
            try {
                const {
                    data: { session: currentSession },
                } = await supabase.auth.getSession();
                setSession(currentSession);
                setUser(currentSession?.user ?? null);
            } catch (error) {
                console.error('Error in getSession:', error);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

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
        console.log('Attempting to sign up with:', credentials.email);
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
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const value: AuthContextType = {
        user,
        session,
        isAuthenticated,
        loading,
        signOut,
        signIn,
        signUp,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Component that handles query cache clearing - must be inside QueryClientProvider
export function AuthQueryManager() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            const previousUserId = user?.id;
            const newUserId = newSession?.user?.id;

            // Clear query cache when user changes or signs out
            if (
                event === 'SIGNED_OUT' ||
                (previousUserId && newUserId && previousUserId !== newUserId)
            ) {
                console.log('🧹 Clearing query cache due to user change/sign out');
                queryClient.clear();
            }

            // Also clear cache when a new user signs in for the first time
            if (event === 'SIGNED_IN' && !previousUserId && newUserId) {
                console.log('🧹 Clearing query cache for fresh sign in');
                queryClient.clear();
            }
        });

        return () => subscription.unsubscribe();
    }, [user?.id, queryClient]);

    return null; // This component doesn't render anything
}
