import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const PasswordResetPage: React.FC = () => {
    const { updatePassword, clearPasswordRecovery, signOut } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async () => {
        setError(null);
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        try {
            setLoading(true);
            await updatePassword(password);
            setDone(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message.toLowerCase() : '';
            if (msg.includes('different') || msg.includes('same password') || msg.includes('old password')) {
                setError('Your new password cannot be the same as your current password. Please choose a different one.');
            } else if (msg.includes('password') && (msg.includes('weak') || msg.includes('contain') || msg.includes('characters') || msg.includes('strength') || msg.includes('policy') || msg.includes('least'))) {
                setError('Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a special character (e.g. !@#$%).');
            } else {
                setError('Failed to update password. The reset link may have expired. Please request a new one.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = () => {
        clearPasswordRecovery();
    };

    const handleCancel = async () => {
        await signOut();
        clearPasswordRecovery();
    };

    return (
        <div className="min-h-screen bg-dark-bg flex items-center justify-center px-4">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-dark-text mb-2">PayoffPal</h1>
                    <p className="text-dark-text-secondary">Your Personal Debt Management Companion</p>
                </div>

                <div className="bg-dark-card rounded-lg p-8 space-y-6 border border-dark-border">
                    <div>
                        <h2 className="text-xl font-semibold text-dark-text mb-2">Set New Password</h2>
                        <p className="text-sm text-dark-text-secondary">Choose a strong new password for your account.</p>
                    </div>

                    {done ? (
                        <div className="space-y-4">
                            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-center space-y-1">
                                <p className="text-sm font-medium text-green-400">Password updated successfully</p>
                                <p className="text-xs text-dark-text-secondary">You can now use your new password to sign in.</p>
                            </div>
                            <button
                                onClick={handleContinue}
                                className="w-full bg-accent hover:bg-accent-hover text-dark-bg font-medium py-3 px-4 rounded-lg transition-colors"
                            >
                                Continue to App
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {error && (
                                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}
                            <div className="space-y-3">
                                <input
                                    type="password"
                                    placeholder="New password (min. 8 characters)"
                                    value={password}
                                    onChange={e => { setPassword(e.target.value); setError(null); }}
                                    className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm new password"
                                    value={confirm}
                                    onChange={e => { setConfirm(e.target.value); setError(null); }}
                                    onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                                    className="w-full bg-dark-border text-dark-text placeholder-dark-text-secondary px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !password || !confirm}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Updating...' : 'Set New Password'}
                                </button>
                                <button
                                    onClick={handleCancel}
                                    className="w-full text-sm text-dark-text-secondary hover:text-dark-text transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PasswordResetPage;
