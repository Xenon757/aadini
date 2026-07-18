import React, { createContext, useContext, useEffect, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import {
    getCurrentUser,
    fetchUserAttributes,
    fetchAuthSession,
    signIn,
    signUp,
    confirmSignUp,
    resendSignUpCode,
    signInWithRedirect,
    signOut as amplifySignOut,
    resetPassword,
    confirmResetPassword,
    updatePassword,
} from 'aws-amplify/auth';

interface AuthUser {
    userId: string;
    email: string | null;
    // Federated (Google) accounts have no Cognito password to change; native
    // accounts do. Derived from the `identities` claim Cognito adds to the ID
    // token for federated sign-ins.
    signInMethod: 'email' | 'google';
}

interface AuthContextType {
    user: AuthUser | null;
    isGuest: boolean;
    loading: boolean;
    pendingAuthMode: 'signin' | 'signup' | null;
    pendingConfirmation: { email: string } | null;
    signInWithGoogle: () => Promise<void>;
    signInWithEmail: (email: string, password: string) => Promise<void>;
    signUpWithEmail: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
    confirmSignUpCode: (email: string, code: string) => Promise<void>;
    resendConfirmationCode: (email: string) => Promise<void>;
    continueAsGuest: () => void;
    signOut: () => Promise<void>;
    openAuth: (mode: 'signin' | 'signup') => void;
    closeAuth: () => void;
    requestPasswordReset: (email: string) => Promise<void>;
    confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<void>;
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadCurrentUser = async (): Promise<AuthUser | null> => {
    try {
        const current = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        const session = await fetchAuthSession();
        const hasFederatedIdentity = !!session.tokens?.idToken?.payload?.identities;
        return {
            userId: current.userId,
            email: attributes.email ?? null,
            signInMethod: hasFederatedIdentity ? 'google' : 'email',
        };
    } catch {
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isGuest, setIsGuest] = useState<boolean>(false);
    const [loading, setLoading] = useState(true);
    const [pendingAuthMode, setPendingAuthMode] = useState<'signin' | 'signup' | null>(null);
    const [pendingConfirmation, setPendingConfirmation] = useState<{ email: string } | null>(null);

    useEffect(() => {
        const guestStatus = localStorage.getItem('guestMode');
        if (guestStatus === 'true') {
            setIsGuest(true);
            setLoading(false);
            return;
        }

        loadCurrentUser().then(u => {
            setUser(u);
            setLoading(false);
        });

        const hubListener = Hub.listen('auth', ({ payload }) => {
            switch (payload.event) {
                case 'signedIn':
                    // Only the guestMode flag is cleared here. guest_finances/guest_settings
                    // (the actual data) are left alone until the data layer's import prompt
                    // resolves, so a guest's local data is never silently discarded.
                    localStorage.removeItem('guestMode');
                    setIsGuest(false);
                    loadCurrentUser().then(setUser);
                    break;
                case 'signedOut':
                    setUser(null);
                    break;
            }
        });

        return () => hubListener();
    }, []);

    const signInWithGoogle = async (): Promise<void> => {
        try {
            await signInWithRedirect({ provider: 'Google' });
        } catch (err) {
            // A stale/half-broken session in browser storage makes Amplify
            // throw "already authenticated" — clear it and retry once so
            // users aren't stuck behind a generic error.
            if (err instanceof Error && err.name === 'UserAlreadyAuthenticatedException') {
                await amplifySignOut();
                await signInWithRedirect({ provider: 'Google' });
                return;
            }
            throw err;
        }
    };

    const signInWithEmail = async (email: string, password: string): Promise<void> => {
        const { isSignedIn, nextStep } = await signIn({ username: email, password });
        if (!isSignedIn) {
            if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
                setPendingConfirmation({ email });
                throw new Error('ACCOUNT_NOT_CONFIRMED');
            }
            throw new Error(`Additional sign-in step required: ${nextStep.signInStep}`);
        }
    };

    const signUpWithEmail = async (email: string, password: string): Promise<{ needsConfirmation: boolean }> => {
        try {
            const { isSignUpComplete, nextStep } = await signUp({
                username: email,
                password,
                options: { userAttributes: { email } },
            });
            if (!isSignUpComplete && nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
                setPendingConfirmation({ email });
                return { needsConfirmation: true };
            }
            return { needsConfirmation: false };
        } catch (err) {
            if (err instanceof Error && err.name === 'UsernameExistsException') {
                throw new Error('EMAIL_ALREADY_EXISTS');
            }
            throw err;
        }
    };

    const confirmSignUpCode = async (email: string, code: string): Promise<void> => {
        await confirmSignUp({ username: email, confirmationCode: code });
        setPendingConfirmation(null);
    };

    const resendConfirmationCode = async (email: string): Promise<void> => {
        await resendSignUpCode({ username: email });
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

    const requestPasswordReset = async (email: string): Promise<void> => {
        await resetPassword({ username: email });
    };

    const confirmPasswordReset = async (email: string, code: string, newPassword: string): Promise<void> => {
        await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
    };

    const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
        await updatePassword({ oldPassword, newPassword });
    };

    const signOut = async (): Promise<void> => {
        if (isGuest) {
            localStorage.removeItem('guestMode');
            localStorage.removeItem('guest_finances');
            localStorage.removeItem('guest_settings');
            setIsGuest(false);
        } else {
            await amplifySignOut();
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user, isGuest, loading, pendingAuthMode, pendingConfirmation,
            signInWithGoogle, signInWithEmail, signUpWithEmail, confirmSignUpCode, resendConfirmationCode,
            continueAsGuest, signOut, openAuth, closeAuth,
            requestPasswordReset, confirmPasswordReset, changePassword,
        }}>
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
