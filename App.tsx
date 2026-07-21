import React, { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FinanceProvider, useFinance } from './contexts/FinanceContext';
import { HomeIcon, WalletIcon, DocumentMagnifyingGlassIcon, ChartBarIcon, Cog6ToothIcon } from './components/Icons';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const FinancesPage = lazy(() => import('./pages/FinancesPage'));
const LoanCheckPage = lazy(() => import('./pages/LoanCheckPage'));
const PayoffPlanPage = lazy(() => import('./pages/PayoffPlanPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const AppContent: React.FC = () => {
    const { user, isGuest, loading, pendingAuthMode, continueAsGuest, authError } = useAuth();
    const [preAuthMode, setPreAuthMode] = useState<'signin' | 'signup' | null>(null);

    // Publicly reachable regardless of auth state (linked from the Plaid
    // application and external consent screens).
    if (window.location.pathname === '/privacy') {
        return <PrivacyPage />;
    }

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-dark-bg">
                <p className="text-lg text-dark-text-secondary">Loading...</p>
            </div>
        );
    }

    if (!user && !isGuest) {
        // A failed OAuth return should land on the login screen showing the
        // error, not bounce silently to the marketing page.
        if (preAuthMode !== null || authError) {
            return <LoginPage initialMode={preAuthMode ?? 'signin'} onBack={() => setPreAuthMode(null)} />;
        }
        return (
            <LandingPage
                onSignIn={() => setPreAuthMode('signin')}
                onSignUp={() => setPreAuthMode('signup')}
                onGuestMode={continueAsGuest}
            />
        );
    }

    if (isGuest && pendingAuthMode !== null) {
        return <LoginPage initialMode={pendingAuthMode} />;
    }

    return (
        <FinanceProvider>
            <MainApp />
        </FinanceProvider>
    );
};

const AppHeader: React.FC = () => {
    const { user, isGuest, signOut, openAuth } = useAuth();

    return (
        <header className="fixed top-0 left-0 right-0 bg-dark-card border-b border-dark-border px-4 py-3 z-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
                {isGuest && (
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-1 text-sm text-dark-text-secondary hover:text-dark-text transition-colors"
                        aria-label="Back to landing page"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                )}
                <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <img src="/PayoffPal_Logo_Light.png" alt="PayoffPal" className="h-10 w-auto object-contain" />
                    <span className="text-sm font-semibold text-accent tracking-wide">PayoffPal</span>
                </Link>
            </div>
            <div className="flex items-center gap-2">
                {isGuest ? (
                    <>
                        <button
                            onClick={() => openAuth('signin')}
                            className="text-sm font-medium text-dark-text-secondary hover:text-dark-text border border-dark-border rounded-lg px-3 py-1.5 transition-colors"
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => openAuth('signup')}
                            className="text-sm font-medium bg-accent text-dark-bg rounded-lg px-3 py-1.5 hover:bg-accent-hover transition-colors"
                        >
                            Sign Up
                        </button>
                    </>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-dark-text-secondary hidden sm:block">{user?.email}</span>
                        <button
                            onClick={() => signOut()}
                            className="text-sm font-medium text-dark-text-secondary hover:text-dark-text border border-dark-border rounded-lg px-3 py-1.5 transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};

const MainApp: React.FC = () => {
    const { loading } = useFinance();

    const navItems = [
        { path: '/', label: 'Home', icon: <HomeIcon /> },
        { path: '/finances', label: 'Finances', icon: <WalletIcon /> },
        { path: '/loan-check', label: 'Loan Check', icon: <DocumentMagnifyingGlassIcon /> },
        { path: '/payoff-plan', label: 'Payoff', icon: <ChartBarIcon /> },
        { path: '/settings', label: 'Settings', icon: <Cog6ToothIcon /> },
    ];

    const loadingFallback = (
        <div className="flex justify-center items-center h-screen">
            <p className="text-lg text-dark-text-secondary">Loading...</p>
        </div>
    );

    if (loading) {
        return loadingFallback;
    }

    return (
        <BrowserRouter>
            <div className="flex flex-col min-h-screen bg-dark-bg text-dark-text font-sans">
                <AppHeader />
                <main className="flex-grow pt-14 pb-28">
                    <Suspense fallback={loadingFallback}>
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/finances" element={<FinancesPage />} />
                            <Route path="/loan-check" element={<LoanCheckPage />} />
                            <Route path="/payoff-plan" element={<PayoffPlanPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                        </Routes>
                    </Suspense>
                     <div className="text-center text-xs text-dark-text-secondary px-4 pt-8">
                        Legal Disclaimer: This app provides general educational guidance only and does not replace financial advice.
                    </div>
                </main>
                <footer className="fixed bottom-0 left-0 right-0 bg-dark-card border-t border-dark-border px-4 py-2 z-50">
                    <nav className="flex justify-around">
                        {navItems.map(({ path, label, icon }) => (
                            <NavLink
                                key={path}
                                to={path}
                                className={({ isActive }) =>
                                    `flex flex-col items-center justify-center space-y-1 w-16 transition-colors duration-200 ${
                                        isActive ? 'text-accent' : 'text-dark-text-secondary hover:text-dark-text'
                                    }`
                                }
                            >
                                {icon}
                                <span className="text-xs whitespace-nowrap">{label}</span>
                            </NavLink>
                        ))}
                    </nav>
                </footer>
            </div>
        </BrowserRouter>
    );
};

/** Surfaces cloud-save failures (dispatched by useAmplifyStorage) as a banner. */
const SaveErrorBanner: React.FC = () => {
    const [message, setMessage] = useState<string | null>(null);
    React.useEffect(() => {
        const handler = (e: Event) => setMessage((e as CustomEvent<string>).detail);
        window.addEventListener('payoffpal:save-error', handler);
        return () => window.removeEventListener('payoffpal:save-error', handler);
    }, []);
    if (!message) return null;
    return (
        <div className="fixed top-0 inset-x-0 z-[60] bg-red-900/90 text-red-100 text-sm px-4 py-2 flex items-start justify-between gap-3">
            <span><strong>Couldn't save to the cloud:</strong> {message}</span>
            <button onClick={() => setMessage(null)} className="text-red-200 hover:text-white font-bold px-2">×</button>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <SaveErrorBanner />
            <AppContent />
        </AuthProvider>
    );
};

export default App;
