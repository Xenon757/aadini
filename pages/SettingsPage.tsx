
import React, { useState } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { useAuth } from '../contexts/AuthContext';
import { RiskProfile } from '../types';
import { CheckCircleIcon } from '../components/Icons';
import ConnectedBanksCard from '../components/ConnectedBanksCard';

const SettingsPage: React.FC = () => {
    const { settings, setSettings, deleteAllData } = useFinance();
    const { user, isGuest, signOut, openAuth, changePassword } = useAuth();
    const [pwCurrent, setPwCurrent] = useState('');
    const [pwNew, setPwNew] = useState('');
    const [pwConfirm, setPwConfirm] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState<string | null>(null);
    const [pwSuccess, setPwSuccess] = useState(false);

    const isEmailUser = user?.signInMethod === 'email';

    const PASSWORD_REQUIREMENTS = 'Password must be at least 8 characters and include uppercase and lowercase letters, a number, and a special character (e.g. !@#$%).';

    const handleChangePassword = async () => {
        setPwError(null);
        setPwSuccess(false);
        if (!pwCurrent) {
            setPwError('Please enter your current password.');
            return;
        }
        if (pwNew.length < 8) {
            setPwError(PASSWORD_REQUIREMENTS);
            return;
        }
        if (pwNew !== pwConfirm) {
            setPwError('Passwords do not match.');
            return;
        }
        try {
            setPwLoading(true);
            await changePassword(pwCurrent, pwNew);
            setPwSuccess(true);
            setPwCurrent('');
            setPwNew('');
            setPwConfirm('');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message.toLowerCase() : '';
            if (msg.includes('different') || msg.includes('same password') || msg.includes('old password')) {
                setPwError('Your new password cannot be the same as your current password. Please choose a different one.');
            } else if (msg.includes('password') && (msg.includes('weak') || msg.includes('contain') || msg.includes('characters') || msg.includes('strength') || msg.includes('policy') || msg.includes('least'))) {
                setPwError(PASSWORD_REQUIREMENTS);
            } else {
                setPwError('Failed to update password. Please sign out and sign back in, then try again.');
            }
        } finally {
            setPwLoading(false);
        }
    };

    const handleRiskProfileChange = (profile: RiskProfile) => {
        setSettings(prev => ({...prev, riskProfile: profile}));
    };

    const handleDeleteAllData = async () => {
        if (window.confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
            await deleteAllData();
            window.location.reload();
        }
    };

    const handleSignOut = async () => {
        if (window.confirm('Are you sure you want to sign out?')) {
            await signOut();
            window.location.reload();
        }
    };

    const riskOptions = [
        {
            profile: RiskProfile.Low,
            label: 'Low Risk',
            description: "Recommends keeping total DTI at or below 30%."
        },
        {
            profile: RiskProfile.Average,
            label: 'Average Risk',
            description: "Recommends keeping total DTI at or below 36%."
        },
        {
            profile: RiskProfile.High,
            label: 'High Risk (Not Recommended)',
            description: "Recommends keeping total DTI at or below 40%."
        },
    ];

    return (
        <div className="p-6 sm:p-8 max-w-2xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-accent">Settings</h1>
                <p className="text-dark-text-secondary">Customize your PayoffPal experience.</p>
            </header>

            <div className="space-y-8">
                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                    <h2 className="text-xl font-semibold mb-4">Account</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-dark-bg rounded-lg">
                            <div>
                                <p className="text-sm text-dark-text-secondary">Status</p>
                                <p className="font-medium text-dark-text">
                                    {isGuest ? 'Guest Mode' : user?.email || 'Signed In'}
                                </p>
                            </div>
                        </div>
                        {isGuest ? (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => openAuth('signin')}
                                    className="flex-1 bg-dark-border hover:bg-opacity-80 text-dark-text font-medium py-2 px-4 rounded-lg transition-colors"
                                >
                                    Sign In
                                </button>
                                <button
                                    onClick={() => openAuth('signup')}
                                    className="flex-1 bg-accent hover:bg-accent-hover text-dark-bg font-medium py-2 px-4 rounded-lg transition-colors"
                                >
                                    Sign Up
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleSignOut}
                                className="w-full bg-dark-border hover:bg-opacity-80 text-dark-text font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                </div>

                {!isGuest && isEmailUser && (
                    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                        <h2 className="text-xl font-semibold mb-1">Change Password</h2>
                        <p className="text-sm text-dark-text-secondary mb-5">Choose a strong password of at least 8 characters.</p>
                        <div className="space-y-3">
                            {pwError && (
                                <div className="bg-red-900/20 border border-red-800 rounded-lg p-3">
                                    <p className="text-sm text-red-400">{pwError}</p>
                                </div>
                            )}
                            {pwSuccess && (
                                <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                                    <p className="text-sm text-green-400">Password updated successfully.</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm text-dark-text-secondary mb-1">Current Password</label>
                                <input
                                    type="password"
                                    value={pwCurrent}
                                    onChange={e => { setPwCurrent(e.target.value); setPwError(null); setPwSuccess(false); }}
                                    placeholder="Your current password"
                                    className="w-full bg-dark-bg border-dark-border rounded-md focus:ring-accent focus:border-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-text-secondary mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={pwNew}
                                    onChange={e => { setPwNew(e.target.value); setPwError(null); setPwSuccess(false); }}
                                    placeholder="Min. 8 characters"
                                    className="w-full bg-dark-bg border-dark-border rounded-md focus:ring-accent focus:border-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-text-secondary mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={pwConfirm}
                                    onChange={e => { setPwConfirm(e.target.value); setPwError(null); setPwSuccess(false); }}
                                    placeholder="Repeat new password"
                                    className="w-full bg-dark-bg border-dark-border rounded-md focus:ring-accent focus:border-accent"
                                />
                            </div>
                            <button
                                onClick={handleChangePassword}
                                disabled={pwLoading || !pwNew || !pwConfirm}
                                className="w-full bg-accent hover:bg-accent-hover text-dark-bg font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {pwLoading ? 'Updating...' : 'Update Password'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                    <h2 className="text-xl font-semibold mb-1">Payoff Risk Profile</h2>
                    <p className="text-dark-text-secondary mb-5">This sets the Debt-to-Income (DTI) ratio threshold for loan affordability checks.</p>

                    <div className="space-y-5">
                        {riskOptions.map(option => (
                            <label key={option.profile} className="flex items-start cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="riskProfile"
                                    value={option.profile}
                                    checked={settings.riskProfile === option.profile}
                                    onChange={() => handleRiskProfileChange(option.profile)}
                                    className="form-radio h-5 w-5 text-accent bg-dark-bg border-dark-border focus:ring-accent mt-1"
                                />
                                <div className="ml-3">
                                    <span className="font-semibold text-dark-text">{option.label}</span>
                                    <p className="text-sm text-dark-text-secondary">{option.description}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                 <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                    <h2 className="text-xl font-semibold mb-1">Payoff Reminders</h2>
                    <p className="text-dark-text-secondary mb-5">(UI Mockup) Get local notifications to stay on track with your payoff plan.</p>
                    <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-md">
                        <span className="font-medium">Enable Payoff Reminders</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" value="" className="sr-only peer" disabled/>
                            <div className="w-11 h-6 bg-dark-border peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                        </label>
                    </div>
                </div>

                <ConnectedBanksCard />

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                    <h2 className="text-xl font-semibold mb-4">Data Management</h2>
                    <button
                        onClick={handleDeleteAllData}
                        className="w-full bg-red-600/20 text-red-400 border border-red-500 font-bold py-2 px-4 rounded-lg hover:bg-red-600/40 transition-colors"
                    >
                        Delete All Data
                    </button>
                    <p className="text-xs text-dark-text-secondary mt-2 text-center">Deleting all your data will reset the app.</p>
                </div>

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border space-y-4">
                    <h2 className="text-xl font-semibold text-dark-text">About PayoffPal</h2>
                    <p className="text-dark-text-secondary">
                        PayoffPal determines whether a new loan is affordable and financially sound based on your income, expenses, and current debts. It also helps you pay off existing loans faster using the Avalanche Method—prioritizing high-interest debt first to minimize total interest paid.
                    </p>
                    <p className="text-dark-text-secondary">
                        Whether you're evaluating a new loan or managing multiple debts, PayoffPal provides clear, actionable insights like your debt-to-income ratio, loan affordability rating (Safe, Borderline, or Not Recommended), and personalized payoff timeline.
                    </p>
                </div>

                <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                    <h2 className="text-xl font-semibold text-dark-text">Key Features</h2>
                    <ul className="space-y-4 mt-5">
                        <FeatureItem text="Simple loan and income entry forms with real-time calculations" />
                        <FeatureItem text="Smart affordability check based on your financial situation and chosen risk level" />
                        <FeatureItem text="Debt payoff planning using the Avalanche method" />
                        <FeatureItem text="Interactive payoff simulator and interest savings tracker" />
                        <FeatureItem text="No Ads." />
                    </ul>
                </div>
            </div>
        </div>
    );
};

const FeatureItem: React.FC<{ text: string }> = ({ text }) => (
    <li className="flex items-start">
        <CheckCircleIcon className="h-5 w-5 text-accent flex-shrink-0 mr-3 mt-0.5" />
        <span className="text-dark-text-secondary">{text}</span>
    </li>
);

export default SettingsPage;
