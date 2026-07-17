import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
    initialMode?: 'signin' | 'signup';
    onBack?: () => void;
}

type ForgotView = 'auth' | 'forgot-email' | 'forgot-code';

const LoginPage: React.FC<LoginPageProps> = ({ initialMode, onBack }) => {
    const {
        signInWithGoogle, signInWithEmail, signUpWithEmail, confirmSignUpCode, resendConfirmationCode,
        continueAsGuest, isGuest, closeAuth, requestPasswordReset, confirmPasswordReset, pendingConfirmation,
    } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
    const [view, setView] = useState<ForgotView>('auth');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [signUpCode, setSignUpCode] = useState('');
    const [resendStatus, setResendStatus] = useState<'idle' | 'sent'>('idle');

    const [resetEmail, setResetEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');
    const [resetDone, setResetDone] = useState(false);

    const getErrorMessage = (err: unknown): string =>
        err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '');

    const handleGoogleSignIn = async () => {
        try {
            setLoading(true);
            setError(null);
            await signInWithGoogle();
        } catch (err) {
            setError('Failed to sign in with Google. Please try again.');
            setLoading(false);
        }
    };

    const handleEmailAuth = async () => {
        try {
            setLoading(true);
            setError(null);
            if (isSignUp) {
                const { needsConfirmation } = await signUpWithEmail(email, password);
                if (!needsConfirmation) {
                    await signInWithEmail(email, password);
                }
                // else: context's pendingConfirmation is now set, view switches to code entry below
            } else {
                await signInWithEmail(email, password);
            }
        } catch (err) {
            const msg = getErrorMessage(err);
            if (isSignUp && msg === 'EMAIL_ALREADY_EXISTS') {
                setIsSignUp(false);
                setError('An account with this email already exists. Please sign in instead.');
            } else if (msg === 'ACCOUNT_NOT_CONFIRMED') {
                // pendingConfirmation was set in context; code-entry view takes over
            } else if (msg) {
                setError(msg);
            } else {
                setError(isSignUp ? 'Failed to create account. Please try again.' : 'Invalid email or password.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmSignUpCode = async () => {
        if (!pendingConfirmation) return;
        try {
            setLoading(true);
            setError(null);
            await confirmSignUpCode(pendingConfirmation.email, signUpCode);
            await signInWithEmail(pendingConfirmation.email, password);
        } catch (err) {
            setError(getErrorMessage(err) || 'Invalid or expired code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendCode = async () => {
        if (!pendingConfirmation) return;
        try {
            setError(null);
            await resendConfirmationCode(pendingConfirmation.email);
            setResendStatus('sent');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to resend code.');
        }
    };

    const handleGuestContinue = () => {
        continueAsGuest();
    };

    const handleRequestReset = async () => {
        if (!resetEmail) {
            setError('Please enter your email address first.');
            return;
        }
        try {
            setLoading(true);
            setError(null);
            await requestPasswordReset(resetEmail);
            setView('forgot-code');
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to send reset code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmReset = async () => {
        setError(null);
        if (resetNewPassword.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (resetNewPassword !== resetConfirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        try {
            setLoading(true);
            await confirmPasswordReset(resetEmail, resetCode, resetNewPassword);
            setResetDone(true);
        } catch (err) {
            setError(getErrorMessage(err) || 'Failed to reset password. The code may have expired.');
        } finally {
            setLoading(false);
        }
    };

    const Shell: React.FC<{ children: React.ReactNode; backAction?: () => void; backLabel?: string }> = ({ children, backAction, backLabel }) => (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8">
                {backAction && (
                    <div>
                        <button onClick={backAction} className="text-sm text-dark-text-secondary hover:text-dark-text transition-colors flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {backLabel ?? 'Back'}
                        </button>
                    </div>
                )}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-dark-text mb-2">PayoffPal</h1>
                    <p className="text-dark-text-secondary">Your Personal Debt Management Companion</p>
                </div>
                <div className="bg-dark-card rounded-lg p-8 space-y-6 border border-dark-border">
                    {children}
                </div>
            </div>
        </div>
    );

    // --- Sign-up confirmation code screen ---
    if (pendingConfirmation) {
        return (
            <Shell>
                <div>
                    <h2 className="text-xl font-semibold text-dark-text mb-2">Enter Confirmation Code</h2>
                    <p className="text-sm text-dark-text-secondary">
                        We sent a 6-digit code to <span className="text-dark-text">{pendingConfirmation.email}</span>. Enter it below to activate your account.
                    </p>
                </div>
                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
                {resendStatus === 'sent' && (
                    <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                        <p className="text-sm text-green-400">A new code has been sent.</p>
                    </div>
                )}
                <div className="space-y-3">
                    <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        value={signUpCode}
                        onChange={(e) => setSignUpCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmSignUpCode()}
                        className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleConfirmSignUpCode}
                        disabled={loading || !signUpCode}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Confirming...' : 'Confirm & Continue'}
                    </button>
                    <button onClick={handleResendCode} className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200">
                        Resend code
                    </button>
                </div>
            </Shell>
        );
    }

    // --- Forgot password: request code ---
    if (view === 'forgot-email') {
        return (
            <Shell backAction={() => { setView('auth'); setError(null); }} backLabel="Back to Sign In">
                <div>
                    <h2 className="text-xl font-semibold text-dark-text mb-2">Reset Password</h2>
                    <p className="text-sm text-dark-text-secondary">Enter your email and we'll send you a code to reset your password.</p>
                </div>
                {error && (
                    <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
                <div className="space-y-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleRequestReset}
                        disabled={loading || !resetEmail}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Sending...' : 'Send Reset Code'}
                    </button>
                </div>
            </Shell>
        );
    }

    // --- Forgot password: enter code + new password ---
    if (view === 'forgot-code') {
        return (
            <Shell backAction={() => { setView('forgot-email'); setError(null); setResetDone(false); }} backLabel="Back">
                <div>
                    <h2 className="text-xl font-semibold text-dark-text mb-2">Set New Password</h2>
                    <p className="text-sm text-dark-text-secondary">Enter the code we sent to <span className="text-dark-text">{resetEmail}</span> and choose a new password.</p>
                </div>
                {resetDone ? (
                    <div className="space-y-4">
                        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center space-y-1">
                            <p className="text-sm font-medium text-green-400">Password updated successfully</p>
                            <p className="text-xs text-dark-text-secondary">You can now sign in with your new password.</p>
                        </div>
                        <button
                            onClick={() => { setView('auth'); setIsSignUp(false); setResetDone(false); }}
                            className="w-full bg-accent hover:bg-accent-hover text-dark-bg font-medium py-3 px-4 rounded-lg transition-colors"
                        >
                            Back to Sign In
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {error && (
                            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                                <p className="text-sm text-red-400">{error}</p>
                            </div>
                        )}
                        <input
                            type="text"
                            inputMode="numeric"
                            placeholder="6-digit code"
                            value={resetCode}
                            onChange={(e) => setResetCode(e.target.value)}
                            className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="password"
                            placeholder="New password (min. 8 characters)"
                            value={resetNewPassword}
                            onChange={(e) => setResetNewPassword(e.target.value)}
                            className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                            type="password"
                            placeholder="Confirm new password"
                            value={resetConfirmPassword}
                            onChange={(e) => setResetConfirmPassword(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleConfirmReset()}
                            className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleConfirmReset}
                            disabled={loading || !resetCode || !resetNewPassword || !resetConfirmPassword}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Updating...' : 'Set New Password'}
                        </button>
                    </div>
                )}
            </Shell>
        );
    }

    // --- Default: sign in / sign up ---
    return (
        <Shell backAction={onBack ?? (isGuest ? closeAuth : undefined)} backLabel={onBack ? 'Back to home' : 'Back to app'}>
            <div>
                <h2 className="text-xl font-semibold text-dark-text mb-2">Welcome</h2>
                <p className="text-sm text-dark-text-secondary">Sign in to sync your data across devices or continue as a guest.</p>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-400">{error}</p>
                </div>
            )}

            <div className="space-y-4">
                <button
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    {loading ? 'Signing in...' : 'Continue with Google'}
                </button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-dark-border"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-dark-card text-dark-text-secondary">or</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEmailAuth()}
                        className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {!isSignUp && (
                        <div className="text-right">
                            <button
                                type="button"
                                onClick={() => { setView('forgot-email'); setResetEmail(email); setError(null); }}
                                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Forgot password?
                            </button>
                        </div>
                    )}
                    <button
                        onClick={handleEmailAuth}
                        disabled={loading || !email || !password}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (isSignUp ? 'Creating Account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>
                    {isSignUp && (
                        <p className="text-xs text-dark-text-secondary text-center">
                            By creating an account, you agree to our{' '}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-hover underline">
                                Privacy Policy
                            </a>.
                        </p>
                    )}
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                        className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                    >
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>

                {!isGuest && (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-dark-border"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-dark-card text-dark-text-secondary">or</span>
                            </div>
                        </div>
                        <button
                            onClick={handleGuestContinue}
                            className="w-full bg-dark-border hover:bg-opacity-80 text-dark-text font-medium py-3 px-4 rounded-lg transition-colors duration-200"
                        >
                            Continue as Guest
                        </button>
                    </>
                )}
            </div>

            <div className="text-xs text-dark-text-secondary text-center">
                <p>Guest mode stores data locally on your device only.</p>
                <p className="mt-1">Sign in to sync across devices.</p>
            </div>
        </Shell>
    );
};

export default LoginPage;
