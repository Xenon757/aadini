import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateAvalanchePayoff } from '../services/loanCalculator';
import { Loan, LoanType } from '../types';

interface LandingPageProps {
    onSignIn: () => void;
    onSignUp: () => void;
    onTrySample: () => void;
}

const DEMO_LOANS: Loan[] = [
    { id: '1', name: 'Credit Card', type: LoanType.CreditCard, balance: 8500, apr: 22.99, term: 5, originalAmount: 10000 },
    { id: '2', name: 'Auto Loan', type: LoanType.Auto, balance: 11200, apr: 7.5, term: 5, originalAmount: 15000 },
    { id: '3', name: 'Student Loan', type: LoanType.Student, balance: 18500, apr: 5.05, term: 10, originalAmount: 25000 },
];

const MAX_EXTRA = 600;

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const formatMonths = (totalMonths: number) => {
    if (!totalMonths || totalMonths <= 0) return 'N/A';
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years > 0 && months > 0) return `${years}y ${months}m`;
    if (years > 0) return `${years} years`;
    return `${months} months`;
};

const getPayoffDate = (totalMonths: number): string => {
    if (!totalMonths || totalMonths <= 0) return 'N/A';
    const now = new Date();
    const payoff = new Date(now.getFullYear(), now.getMonth() + totalMonths, 1);
    return payoff.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

function useInView(threshold = 0.15) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return { ref, inView };
}

function useCountUp(target: number, active: boolean, duration = 1200) {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!active) return;
        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * ease));
            if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [active, target, duration]);
    return value;
}

const FadeInSection: React.FC<{ children: React.ReactNode; delay?: number; className?: string; direction?: 'up' | 'left' | 'right' }> = ({
    children, delay = 0, className = '', direction = 'up'
}) => {
    const { ref, inView } = useInView();
    const translate = direction === 'up' ? 'translateY(32px)' : direction === 'left' ? 'translateX(-32px)' : 'translateX(32px)';
    return (
        <div
            ref={ref}
            className={className}
            style={{
                opacity: inView ? 1 : 0,
                transform: inView ? 'none' : translate,
                transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
            }}
        >
            {children}
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: number; prefix?: string; suffix?: string; color?: string }> = ({
    label, value, prefix = '', suffix = '', color = 'text-dark-text'
}) => {
    const { ref, inView } = useInView();
    const count = useCountUp(value, inView);
    return (
        <div ref={ref} className="bg-dark-bg rounded-xl p-4 border border-dark-border hover:border-accent/40 transition-colors duration-300">
            <p className="text-xs text-dark-text-secondary mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{prefix}{count.toLocaleString()}{suffix}</p>
        </div>
    );
};

const LandingPage: React.FC<LandingPageProps> = ({ onSignIn, onSignUp, onTrySample }) => {
    const [extraPayment, setExtraPayment] = useState(0);
    const [heroVisible, setHeroVisible] = useState(false);
    const [scrollY, setScrollY] = useState(0);
    const howItWorksRef = useRef<HTMLElement>(null);
    const [gradientPos, setGradientPos] = useState({ x: 50, y: 50 });

    useEffect(() => {
        const t = setTimeout(() => setHeroVisible(true), 80);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);


    const payoff = useMemo(() => calculateAvalanchePayoff(DEMO_LOANS, extraPayment), [extraPayment]);

    const chartData = useMemo(() => {
        if (!payoff.steps || payoff.steps.length === 0) return [];
        const step = Math.max(1, Math.floor(payoff.steps.length / 20));
        return payoff.steps
            .filter((_, i) => i % step === 0)
            .map((s, idx) => ({
                month: idx * step + 1,
                'Remaining Debt': Math.round(s.remainingBalance),
            }));
    }, [payoff.steps]);

    const timeSaved = payoff.baselineTimeline - payoff.scenarioTimeline;

    const scrollToHowItWorks = () => {
        howItWorksRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

    const heroStyle = (delay: number) => ({
        opacity: heroVisible ? 1 : 0,
        transform: heroVisible ? 'none' : 'translateY(16px)',
        transition: `opacity 0.6s ease ${isMobile ? 0 : delay}ms, transform 0.6s ease ${isMobile ? 0 : delay}ms`,
    });

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text font-sans overflow-x-hidden">
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(-18px) rotate(1deg); }
                    66% { transform: translateY(-8px) rotate(-1deg); }
                }
                @keyframes float2 {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-24px) rotate(2deg); }
                }
                @keyframes pulseBorder {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(0, 245, 212, 0.15); }
                    50% { box-shadow: 0 0 0 12px rgba(0, 245, 212, 0); }
                }
                @keyframes shimmer {
                    0% { background-position: -200% center; }
                    100% { background-position: 200% center; }
                }
                .hero-orb-1 { animation: float 7s ease-in-out infinite; }
                .hero-orb-2 { animation: float2 9s ease-in-out infinite 1s; }
                .hero-orb-3 { animation: float 11s ease-in-out infinite 2s; }
                .feature-card {
                    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
                }
                .feature-card:hover {
                    transform: translateY(-6px);
                    border-color: rgba(0, 245, 212, 0.4);
                    box-shadow: 0 12px 32px rgba(0, 245, 212, 0.08);
                }
                .problem-card {
                    transition: transform 0.3s ease, border-color 0.3s ease;
                }
                .problem-card:hover {
                    transform: translateY(-4px);
                    border-color: rgba(255,255,255,0.15);
                }
                .cta-primary {
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.2s ease, background-color 0.2s ease, box-shadow 0.2s ease;
                }
                .cta-primary:hover {
                    transform: scale(1.04);
                    box-shadow: 0 16px 40px rgba(0, 245, 212, 0.3);
                }
                .cta-primary:active {
                    transform: scale(0.98);
                }
                .cta-primary::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, rgba(255,255,255,0.25) 0%, transparent 70%);
                    opacity: 0;
                    transition: opacity 0.3s ease;
                }
                .cta-primary:hover::after {
                    opacity: 1;
                }
                .cta-secondary {
                    transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
                }
                .cta-secondary:hover {
                    transform: scale(1.02);
                }
                .cta-ghost {
                    transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
                }
                .cta-ghost:hover {
                    background-color: rgba(255,255,255,0.04);
                }
                .shimmer-text {
                    background: linear-gradient(90deg, #00f5d4 0%, #7fffd4 40%, #00f5d4 80%);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: shimmer 3s linear infinite;
                }
                .who-card {
                    transition: transform 0.25s ease, border-color 0.25s ease, background-color 0.25s ease;
                }
                .who-card:hover {
                    transform: translateX(4px);
                    border-color: rgba(0, 245, 212, 0.35);
                    background-color: rgba(0, 245, 212, 0.04);
                }
                .nav-logo {
                    transition: opacity 0.2s ease, letter-spacing 0.3s ease;
                }
                .nav-logo:hover {
                    opacity: 0.85;
                    letter-spacing: 0.08em;
                }
            `}</style>

            {/* NAV */}
            <nav
                className="fixed top-0 left-0 right-0 z-50 border-b border-dark-border px-6 py-4 flex items-center justify-between"
                style={{
                    backgroundColor: `rgba(13,17,23,${Math.min(0.95, 0.6 + scrollY / 300)})`,
                    backdropFilter: 'blur(12px)',
                    transition: 'background-color 0.3s ease',
                }}
            >
                <span className="nav-logo flex items-center gap-2 cursor-default">
                    <img src="/Modulos_Logo_Light.png" alt="Modulos" className="h-10 w-auto object-contain" />
                    <span className="text-lg font-bold text-accent tracking-wide">Modulos</span>
                </span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onSignIn}
                        className="text-sm font-medium text-dark-text-secondary hover:text-dark-text border border-dark-border rounded-lg px-4 py-2 cta-secondary"
                    >
                        Sign In
                    </button>
                    <button
                        onClick={onSignUp}
                        className="text-sm font-medium bg-accent text-dark-bg rounded-lg px-4 py-2 cta-primary"
                    >
                        Sign Up
                    </button>
                </div>
            </nav>

            {/* SECTION 1 — HERO */}
            <section
                className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 pb-24 relative overflow-hidden"
                style={{
                    background: 'radial-gradient(ellipse 90% 70% at 20% 80%, #162622 0%, #1a2e28 20%, #1d2824 40%, #1a202c 70%, #1c1e2a 100%)',
                }}
                onMouseMove={(e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setGradientPos({
                        x: ((e.clientX - rect.left) / rect.width) * 100,
                        y: ((e.clientY - rect.top) / rect.height) * 100,
                    });
                }}
                onMouseLeave={() => setGradientPos({ x: 50, y: 50 })}
            >
                {/* Interactive cursor gradient — displaces the bg gradient */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle 220px at ${gradientPos.x}% ${gradientPos.y}%, rgba(0,245,212,0.09) 0%, rgba(0,245,212,0.03) 55%, transparent 100%)`,
                        mixBlendMode: 'screen',
                        transition: 'background 0.15s ease',
                    }}
                />

                <div className="relative z-10 max-w-3xl mx-auto mt-8">
                    <div style={heroStyle(0)}>
                        <p className="text-sm font-semibold text-accent uppercase tracking-widest mb-4">
                            Modulos: Your Personal Debt Management Companion
                        </p>
                    </div>
                    <div style={heroStyle(120)}>
                        <h1 className="text-5xl sm:text-6xl font-extrabold text-dark-text leading-tight mb-6">
                            Take Control of<br />
                            <span className="shimmer-text">Your Loans.</span>
                        </h1>
                    </div>
                    <div style={heroStyle(240)}>
                        <p className="text-xl text-dark-text-secondary mb-10 max-w-xl mx-auto leading-relaxed">
                            Instantly see if a loan is affordable and build a smart payoff plan — bank connection optional.
                        </p>
                    </div>
                    <div style={heroStyle(360)}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-5">
                            <button
                                onClick={onSignUp}
                                className="w-full sm:w-auto px-8 py-4 bg-accent text-dark-bg font-bold text-lg rounded-xl shadow-lg shadow-accent/20 cta-primary"
                            >
                                Get Started — Free
                            </button>
                            <button
                                onClick={scrollToHowItWorks}
                                className="w-full sm:w-auto px-8 py-4 border border-dark-border text-dark-text font-semibold text-lg rounded-xl hover:border-accent hover:text-accent cta-secondary"
                            >
                                See How It Works
                            </button>
                        </div>
                        <button
                            onClick={onTrySample}
                            className="w-full sm:w-auto px-8 py-3 border border-dark-text-secondary/40 text-dark-text-secondary font-medium text-base rounded-xl cta-ghost mt-1"
                        >
                            Try a Sample
                        </button>
                        <p className="text-xs text-dark-text-secondary mt-3">Bank Connection Optional</p>
                    </div>
                    <button
                        onClick={scrollToHowItWorks}
                        className="w-full flex justify-center mt-10 animate-bounce cursor-pointer"
                        style={{ opacity: Math.max(0, 1 - scrollY / 120), background: 'none', border: 'none', padding: 0 }}
                    >
                        <svg className="w-6 h-6 text-dark-text-secondary hover:text-accent transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </section>

            {/* SECTION 2 — THE PROBLEM */}
            <section className="py-24 px-6 bg-dark-card border-y border-dark-border">
                <div className="max-w-4xl mx-auto text-center">
                    <FadeInSection>
                        <h2 className="text-3xl sm:text-4xl font-bold mb-14">
                            Most People Don't Know If a Loan Is Actually Affordable
                        </h2>
                    </FadeInSection>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                        {[
                            {
                                icon: (
                                    <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ),
                                text: '"Can I really afford this payment?"',
                            },
                            {
                                icon: (
                                    <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                ),
                                text: '"Will this loan hurt my future?"',
                            },
                            {
                                icon: (
                                    <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                ),
                                text: '"Why am I still stuck in debt?"',
                            },
                        ].map(({ icon, text }, i) => (
                            <FadeInSection key={i} delay={i * 120}>
                                <div className="problem-card bg-dark-bg rounded-xl p-8 border border-dark-border flex flex-col items-center gap-4 h-full">
                                    {icon}
                                    <p className="text-dark-text font-medium text-lg">{text}</p>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>
                    <FadeInSection delay={360}>
                        <p className="text-xl text-accent font-semibold">
                            Modulos gives you a clear, data-backed answer in seconds.
                        </p>
                    </FadeInSection>
                </div>
            </section>

            {/* SECTION 3 — HOW IT WORKS */}
            <section ref={howItWorksRef} id="how-it-works" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-bold">Simple. Fast. Powerful.</h2>
                        </div>
                    </FadeInSection>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                        {[
                            {
                                step: '01',
                                title: 'Add Your Income & Expenses',
                                desc: 'Enter gross or net income, recurring expenses, and existing loans. Takes under 2 minutes.',
                            },
                            {
                                step: '02',
                                title: 'Get an Instant Affordability Check',
                                desc: 'See your Debt-to-Income ratio and whether a new loan is Safe or Not Recommended — based on your risk level.',
                            },
                            {
                                step: '03',
                                title: 'Build a Smarter Payoff Plan',
                                desc: 'The Avalanche Method targets highest-APR loans first, minimizing interest and shortening your payoff timeline.',
                            },
                        ].map(({ step, title, desc }, i) => (
                            <FadeInSection key={i} delay={i * 150}>
                                <div className="feature-card bg-dark-card border border-dark-border rounded-xl p-8 h-full">
                                    <div className="text-5xl font-black text-accent/20 mb-4 leading-none">{step}</div>
                                    <h3 className="text-lg font-bold mb-3 text-dark-text">{title}</h3>
                                    <p className="text-dark-text-secondary text-sm leading-relaxed">{desc}</p>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>

                    {/* INTERACTIVE DEMO */}
                    <FadeInSection>
                        <div className="bg-dark-card border border-dark-border rounded-2xl p-8">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                                <p className="text-xs font-semibold text-accent uppercase tracking-widest">Live Demo</p>
                            </div>
                            <h3 className="text-xl font-bold mb-1">Interactive Payoff Timeline</h3>
                            <p className="text-sm text-dark-text-secondary mb-6">
                                Sample portfolio: Credit Card (22.99% APR) + Auto Loan (7.5%) + Student Loan (5.05%). Drag the slider to see the impact of extra payments.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                <div className="bg-dark-bg rounded-xl p-4 border border-dark-border hover:border-accent/40 transition-colors duration-300">
                                    <p className="text-xs text-dark-text-secondary mb-1">Estimated Payoff Date</p>
                                    <p className="text-xl font-bold text-dark-text">{getPayoffDate(payoff.scenarioTimeline)}</p>
                                    <p className="text-xs text-accent mt-0.5">{formatMonths(payoff.scenarioTimeline)} from now</p>
                                    <p className="text-xs text-dark-text-secondary mt-1">baseline: {getPayoffDate(payoff.baselineTimeline)}</p>
                                </div>
                                <div className="bg-dark-bg rounded-xl p-4 border border-dark-border hover:border-green-400/40 transition-colors duration-300">
                                    <p className="text-xs text-dark-text-secondary mb-1">Time Saved</p>
                                    <p className="text-2xl font-bold text-green-400">{timeSaved > 0 ? formatMonths(timeSaved) : '—'}</p>
                                    <p className="text-xs text-dark-text-secondary mt-1">with extra payments</p>
                                </div>
                                <div className="bg-dark-bg rounded-xl p-4 border border-dark-border hover:border-green-400/40 transition-colors duration-300">
                                    <p className="text-xs text-dark-text-secondary mb-1">Interest Saved</p>
                                    <p className="text-2xl font-bold text-green-400">{payoff.interestSaved > 0 ? formatCurrency(payoff.interestSaved) : '—'}</p>
                                    <p className="text-xs text-dark-text-secondary mt-1">vs. minimum payments</p>
                                </div>
                            </div>

                            {extraPayment > 0 && (
                                <div
                                    className="bg-dark-bg border border-accent/30 rounded-lg px-5 py-3 mb-6 text-sm"
                                    style={{ animation: 'none' }}
                                >
                                    With an extra <span className="font-bold text-accent">{formatCurrency(extraPayment)}/month</span>, you'll be debt-free in{' '}
                                    <span className="font-bold text-dark-text">{formatMonths(payoff.scenarioTimeline)}</span> instead of{' '}
                                    <span className="font-bold text-dark-text">{formatMonths(payoff.baselineTimeline)}</span> — saving{' '}
                                    <span className="font-bold text-green-400">{formatCurrency(payoff.interestSaved)}</span> in interest.
                                </div>
                            )}

                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-medium text-dark-text-secondary">
                                        Extra Monthly Payment
                                    </label>
                                    <span
                                        className="text-sm font-bold text-accent"
                                        style={{ transition: 'transform 0.15s ease', transform: extraPayment > 0 ? 'scale(1.1)' : 'scale(1)' }}
                                    >
                                        {formatCurrency(extraPayment)}
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max={MAX_EXTRA}
                                    step="25"
                                    value={extraPayment}
                                    onChange={(e) => setExtraPayment(Number(e.target.value))}
                                    className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-accent"
                                    style={{ accentColor: '#00f5d4' }}
                                />
                                <div className="flex justify-between text-xs text-dark-text-secondary mt-1">
                                    <span>$0</span>
                                    <span>{formatCurrency(MAX_EXTRA)}</span>
                                </div>
                            </div>

                            <div style={{ width: '100%', height: 260 }}>
                                <ResponsiveContainer>
                                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                        <XAxis
                                            dataKey="month"
                                            stroke="#a0aec0"
                                            tick={{ fontSize: 11 }}
                                            label={{ value: 'Month', position: 'insideBottom', offset: -12, fill: '#a0aec0', fontSize: 12 }}
                                        />
                                        <YAxis
                                            stroke="#a0aec0"
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                            width={55}
                                        />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#2d3748', border: '1px solid #4a5568', borderRadius: '8px', fontSize: 12 }}
                                            formatter={(value: number) => [formatCurrency(value), 'Remaining Debt']}
                                            labelFormatter={(label) => `Month ${label}`}
                                        />
                                        <Bar dataKey="Remaining Debt" fill="#00f5d4" radius={[3, 3, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </FadeInSection>

                    <FadeInSection delay={100}>
                        <div className="text-center mt-10">
                            <button
                                onClick={onSignUp}
                                className="px-8 py-4 bg-accent text-dark-bg font-bold text-lg rounded-xl shadow-lg shadow-accent/20 cta-primary"
                            >
                                Try It Now — Free
                            </button>
                        </div>
                    </FadeInSection>
                </div>
            </section>

            {/* SECTION 4 — CORE FEATURES */}
            <section className="py-24 px-6 bg-dark-card border-y border-dark-border">
                <div className="max-w-5xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-bold">Everything You Need to Make Smarter Financial Decisions</h2>
                        </div>
                    </FadeInSection>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                badge: 'Smart Loan Checker',
                                points: [
                                    'Calculates Debt-to-Income ratio instantly',
                                    'Conservative, moderate, or high-risk thresholds',
                                    'Clear Safe / Not Recommended guidance',
                                ],
                                icon: (
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                ),
                            },
                            {
                                badge: 'Avalanche Payoff Planner',
                                points: [
                                    'Automatically orders loans by highest APR',
                                    'Shows projected payoff date & interest saved',
                                    'Interactive extra-payment slider',
                                ],
                                icon: (
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                ),
                            },
                            {
                                badge: 'Real-Time Dashboard',
                                points: [
                                    'Monthly net income & total debt at a glance',
                                    'DTI ratio with color-coded health status',
                                    'Monthly leftover money tracker',
                                ],
                                icon: (
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                ),
                            },
                        ].map(({ badge, points, icon }, i) => (
                            <FadeInSection key={i} delay={i * 130}>
                                <div className="feature-card bg-dark-bg rounded-xl p-8 border border-dark-border flex flex-col h-full">
                                    <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent mb-5" style={{ transition: 'transform 0.3s ease, background-color 0.3s ease' }}>
                                        {icon}
                                    </div>
                                    <h3 className="text-lg font-bold mb-5">{badge}</h3>
                                    <ul className="space-y-3 flex-1">
                                        {points.map((p, j) => (
                                            <li key={j} className="flex items-start gap-3 text-sm text-dark-text-secondary">
                                                <svg className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                </svg>
                                                {p}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 5 — WHO IT'S FOR */}
            <section className="py-24 px-6">
                <div className="max-w-3xl mx-auto text-center">
                    <FadeInSection>
                        <h2 className="text-3xl sm:text-4xl font-bold mb-14">Built For Real People With Real Financial Questions</h2>
                    </FadeInSection>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-left">
                        {[
                            'Adults managing multiple loans',
                            'People considering a mortgage, auto, or student loan',
                            'Anyone who wants to get out of debt faster',
                            'Individuals who prefer privacy and control',
                        ].map((item, i) => (
                            <FadeInSection key={i} delay={i * 100} direction={i % 2 === 0 ? 'left' : 'right'}>
                                <div className="who-card flex items-center gap-4 bg-dark-card border border-dark-border rounded-xl px-6 py-5">
                                    <svg className="w-5 h-5 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-dark-text font-medium">{item}</span>
                                </div>
                            </FadeInSection>
                        ))}
                    </div>
                </div>
            </section>

            {/* SECTION 6 — WHY MODULOS IS DIFFERENT */}
            <section className="py-24 px-6 bg-dark-card border-y border-dark-border">
                <div className="max-w-3xl mx-auto">
                    <FadeInSection>
                        <div className="text-center mb-14">
                            <h2 className="text-3xl sm:text-4xl font-bold">Why Modulos Is Different</h2>
                        </div>
                    </FadeInSection>
                    <FadeInSection delay={100}>
                        <div className="rounded-xl overflow-hidden border border-dark-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-dark-bg">
                                        <th className="text-left px-6 py-4 text-dark-text-secondary font-semibold w-1/2">Other Apps</th>
                                        <th className="text-left px-6 py-4 text-accent font-semibold w-1/2">Modulos</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ['Require bank login', 'Optional — connect or enter manually'],
                                        ['Push refinancing products', 'No upsells, ever'],
                                        ['Complex dashboards', 'Simple, guided flow'],
                                    ].map(([other, ours], i) => (
                                        <tr
                                            key={i}
                                            className={`${i % 2 === 0 ? 'bg-dark-bg/50' : 'bg-dark-bg/20'} hover:bg-accent/5 transition-colors duration-200`}
                                        >
                                            <td className="px-6 py-4 text-dark-text-secondary flex items-center gap-2">
                                                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                {other}
                                            </td>
                                            <td className="px-6 py-4 text-dark-text font-medium">
                                                <span className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-accent flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                                    </svg>
                                                    {ours}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </FadeInSection>
                </div>
            </section>

            {/* SECTION 7 — FINAL CTA */}
            <section className="py-32 px-6 text-center relative overflow-hidden">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ transform: `translateY(${(scrollY - 2000) * 0.15}px)` }}
                >
                    <div className="hero-orb-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
                </div>
                <FadeInSection>
                    <div className="relative z-10 max-w-2xl mx-auto">
                        <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight mb-6">
                            Know Before You Borrow.<br />
                            Pay Off Faster.<br />
                            <span className="shimmer-text">Sleep Better.</span>
                        </h2>
                        <button
                            onClick={onSignUp}
                            className="px-10 py-5 bg-accent text-dark-bg font-bold text-xl rounded-xl shadow-xl shadow-accent/20 mt-4 cta-primary"
                        >
                            Try Modulos Now — Free
                        </button>
                        <div className="flex justify-center mt-10">
                            <img src="/Modulos_Logo_Light.png" alt="Modulos" className="w-64 h-auto object-contain opacity-90" />
                        </div>
                        <p className="text-sm text-dark-text-secondary mt-6">No credit card required. Bank connection optional. Just clarity.</p>
                    </div>
                </FadeInSection>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-dark-border bg-dark-card py-10 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-6">
                        <div>
                            <p className="text-lg font-bold text-accent">Modulos</p>
                            <p className="text-sm text-dark-text-secondary">Your Personal Debt Management Companion</p>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-dark-text-secondary">
                            <button onClick={onSignIn} className="hover:text-dark-text transition-colors">Sign In</button>
                            <button onClick={onSignUp} className="hover:text-dark-text transition-colors">Sign Up</button>
                        </div>
                    </div>
                    <div className="border-t border-dark-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-dark-text-secondary">
                        <p>Legal Disclaimer: This app provides general educational guidance only and does not replace financial advice.</p>
                        <div className="flex items-center gap-4">
                            <a href="/privacy" className="hover:text-dark-text transition-colors">Privacy Policy</a>
                            <span className="hover:text-dark-text transition-colors cursor-pointer">Terms</span>
                            <span className="hover:text-dark-text transition-colors cursor-pointer">Contact</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
