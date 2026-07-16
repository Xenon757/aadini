import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
    initialMode?: 'signin' | 'signup';
    onBack?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ initialMode, onBack }) => {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail, continueAsGuest, isGuest, closeAuth, sendPasswordReset } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [signUpSuccess, setSignUpSuccess] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

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
                const needsConfirmation = await signUpWithEmail(email, password);
                if (needsConfirmation) {
                    setSignUpSuccess(true);
                }
            } else {
                await signInWithEmail(email, password);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : (typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: unknown }).message) : '');
            if (isSignUp && msg === 'EMAIL_ALREADY_EXISTS') {
                setIsSignUp(false);
                setError('An account with this email already exists. Please sign in instead.');
            } else if (msg) {
                setError(msg);
            } else {
                setError(isSignUp ? 'Failed to create account. Please try again.' : 'Invalid email or password.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGuestContinue = () => {
        continueAsGuest();
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setError('Please enter your email address first.');
            return;
        }
        try {
            setLoading(true);
            setError(null);
            await sendPasswordReset(email);
            setResetSent(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? '';
            setError(msg || 'Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8">
                {(isGuest || onBack) && (
                    <div>
                        <button
                            onClick={onBack ?? closeAuth}
                            className="text-sm text-dark-text-secondary hover:text-dark-text transition-colors flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {onBack ? 'Back to home' : 'Back to app'}
                        </button>
                    </div>
                )}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-dark-text mb-2">PayoffPal</h1>
                    <p className="text-dark-text-secondary">Your Personal Debt Management Companion</p>
                </div>

                <div className="bg-dark-card rounded-lg p-8 space-y-6 border border-dark-border">
                    <div>
                        <h2 className="text-xl font-semibold text-dark-text mb-2">
                            {isForgotPassword ? 'Reset Password' : 'Welcome'}
                        </h2>
                        <p className="text-sm text-dark-text-secondary">
                            {isForgotPassword
                                ? "Enter your email and we'll send you a link to reset your password."
                                : 'Sign in to sync your data across devices or continue as a guest.'}
                        </p>
                    </div>

                    {signUpSuccess && (
                        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center space-y-2">
                            <p className="text-sm font-medium text-green-400">Check your email</p>
                            <p className="text-xs text-dark-text-secondary">We sent a confirmation link to <span className="text-dark-text">{email}</span>. Click it to activate your account.</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}

                    {isForgotPassword ? (
                        <div className="space-y-4">
                            {resetSent ? (
                                <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center space-y-2">
                                    <p className="text-sm font-medium text-green-400">Reset email sent</p>
                                    <p className="text-xs text-dark-text-secondary">Check your inbox for a password reset link. It may take a minute to arrive.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleForgotPassword}
                                        disabled={loading || !email}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Sending...' : 'Send Reset Link'}
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={() => { setIsForgotPassword(false); setResetSent(false); setError(null); }}
                                className="w-full text-sm text-blue-400 hover:text-blue-300 transition-colors duration-200"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : (
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
                                            onClick={() => { setIsForgotPassword(true); setError(null); }}
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
                    )}

                    <div className="text-xs text-dark-text-secondary text-center">
                        <p>Guest mode stores data locally on your device only.</p>
                        <p className="mt-1">Sign in to sync across devices.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
