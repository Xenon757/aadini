import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    isGuest: boolean;
    loading: boolean;
    pendingAuthMode: 'signin' | 'signup' | null;
    isPasswordRecovery: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<boolean>;
    continueAsGuest: () => void;
    signOut: () => Promise<void>;
    openAuth: (mode: 'signin' | 'signup') => void;
    closeAuth: () => void;
    sendPasswordReset: (email: string) => Promise<void>;
    updatePassword: (newPassword: string) => Promise<void>;
    clearPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isGuest, setIsGuest] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [pendingAuthMode, setPendingAuthMode] = useState<'signin' | 'signup' | null>(null);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    useEffect(() => {
        const guestStatus = localStorage.getItem('guestMode');
        if (guestStatus === 'true') {
            setIsGuest(true);
            setLoading(false);
            return;
        }

        const isOAuthRedirect = window.location.hash.includes('access_token') ||
            window.location.search.includes('code=');

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            (() => {
                if (event === 'PASSWORD_RECOVERY') {
                    setIsPasswordRecovery(true);
                    setSession(session);
                    setUser(session?.user ?? null);
                    setLoading(false);
                    return;
                }
                if (event === 'SIGNED_IN' && session?.user) {
                    localStorage.removeItem('guestMode');
                    localStorage.removeItem('guest_finances');
                    localStorage.removeItem('guest_settings');
                    setIsGuest(false);
                }
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            })();
        });

        if (!isOAuthRedirect) {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session) {
                    setLoading(false);
                }
            });
        }

        return () => subscription.unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            }
        });
        if (error) throw error;
    };

    const signInWithEmail = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;

        if (isGuest) {
            localStorage.removeItem('guestMode');
            localStorage.removeItem('guest_finances');
            localStorage.removeItem('guest_settings');
            setIsGuest(false);
        }
    };

    const signUpWithEmail = async (email: string, password: string): Promise<boolean> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });
        if (error) throw new Error(error.message);

        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            throw new Error('EMAIL_ALREADY_EXISTS');
        }

        const needsEmailConfirmation = !!data.user && !data.session;

        if (!needsEmailConfirmation && isGuest) {
            localStorage.removeItem('guestMode');
            localStorage.removeItem('guest_finances');
            localStorage.removeItem('guest_settings');
            setIsGuest(false);
        }

        return needsEmailConfirmation;
    };

    const continueAsGuest = () => {
        localStorage.setItem('guestMode', 'true');
        setIsGuest(true);
        setPendingAuthMode(null);
    };

    const openAuth = (mode: 'signin' | 'signup') => {
        setPendingAuthMode(mode);
    };

    const closeAuth = () => {
        setPendingAuthMode(null);
    };

    const sendPasswordReset = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw new Error(error.message);
    };

    const updatePassword = async (newPassword: string) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(error.message);
    };

    const clearPasswordRecovery = () => {
        setIsPasswordRecovery(false);
    };

    const signOut = async () => {
        if (isGuest) {
            localStorage.removeItem('guestMode');
            localStorage.removeItem('guest_finances');
            localStorage.removeItem('guest_settings');
            setIsGuest(false);
        } else {
            await supabase.auth.signOut();
        }

        setUser(null);
        setSession(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, isGuest, loading, pendingAuthMode, isPasswordRecovery, signInWithGoogle, signInWithEmail, signUpWithEmail, continueAsGuest, signOut, openAuth, closeAuth, sendPasswordReset, updatePassword, clearPasswordRecovery }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
