import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { calculateAvalanchePayoff, getEffectiveMinPayment } from '../services/loanCalculator';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import LoanTrellisChart from '../components/LoanTrellisChart';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

const formatMonthsToYears = (totalMonths: number) => {
    if (totalMonths <= 0) return '0 months';
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    if (years > 0 && months > 0) return `${years} year${years !== 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''}`;
    if (years > 0) return `${years} year${years !== 1 ? 's' : ''}`;
    return `${months} month${months !== 1 ? 's' : ''}`;
};

const getPayoffDate = (totalMonths: number): { date: string; relative: string } => {
    if (totalMonths <= 0) return { date: 'N/A', relative: '' };
    const now = new Date();
    const payoff = new Date(now.getFullYear(), now.getMonth() + totalMonths, 1);
    const date = payoff.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    const relative = formatMonthsToYears(totalMonths);
    return { date, relative };
};

const PayoffPlanPage: React.FC = () => {
    const { finances, monthlyLeftoverMoney, totalDebt } = useFinance();
    const navigate = useNavigate();
    const [extraPayment, setExtraPayment] = useState(0);

    const maxExtraPayment = Math.max(0, Math.min(monthlyLeftoverMoney, totalDebt));

    useEffect(() => {
        if (extraPayment > maxExtraPayment) setExtraPayment(maxExtraPayment);
    }, [maxExtraPayment, extraPayment]);

    const payoff = useMemo(() => calculateAvalanchePayoff(finances.loans, extraPayment), [finances.loans, extraPayment]);

    const sortedLoans = useMemo(() => [...finances.loans].sort((a, b) => b.apr - a.apr), [finances.loans]);

    const chartData = useMemo(() => {
        if (!payoff.steps || payoff.steps.length === 0) return [];
        return payoff.steps.map((step, index) => ({
            month: index + 1,
            'Remaining Debt': Math.max(0, step.remainingBalance),
        }));
    }, [payoff.steps]);

    const timeSavedMonths = payoff.baselineTimeline - payoff.scenarioTimeline;
    const scenarioPayoffDate = getPayoffDate(payoff.scenarioTimeline);
    const baselinePayoffDate = getPayoffDate(payoff.baselineTimeline);

    return (
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-accent">Debt Payoff Plan</h1>
                <p className="text-dark-text-secondary">Visualize your path to being debt-free using the Avalanche Method.</p>
            </header>

            {finances.loans.length === 0 ? (
                <div className="bg-dark-card p-6 rounded-lg border border-dark-border text-center flex flex-col items-center gap-4">
                    <p>No loans found. Add your loans on the Finances page to create a payoff plan.</p>
                    <button
                        onClick={() => navigate('/finances')}
                        className="bg-accent text-dark-bg font-bold py-2 px-4 rounded-lg hover:bg-accent-hover transition-colors"
                    >
                        Add Loans to Finances Page
                    </button>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                        <h2 className="text-xl font-semibold">Payoff Simulation</h2>
                        <p className="text-sm text-dark-text-secondary mt-1">Add extra monthly payments to see how quickly you can pay off your debt. The slider is capped at your available leftover money.</p>
                        <div className="mt-4">
                            <label htmlFor="extraPayment" className="block text-sm font-medium">
                                Extra Monthly Payment: <span className="font-bold text-accent">{formatCurrency(extraPayment)}</span>
                            </label>
                            <input
                                type="range"
                                id="extraPayment"
                                min="0"
                                max={maxExtraPayment}
                                step="10"
                                value={extraPayment}
                                onChange={(e) => setExtraPayment(Number(e.target.value))}
                                className="w-full h-2 bg-dark-border rounded-lg appearance-none cursor-pointer accent-accent mt-2"
                            />
                            <div className="flex justify-between text-xs text-dark-text-secondary">
                                <span>$0</span>
                                <span>{formatCurrency(maxExtraPayment)} (Available)</span>
                            </div>
                        </div>
                        <p className="mt-4 text-sm bg-gray-900/50 p-3 rounded-md border border-dark-border">
                            With <span className="font-bold text-accent">{formatCurrency(extraPayment)}</span> extra, you could be debt-free in{' '}
                            <span className="font-bold text-white">{formatMonthsToYears(payoff.scenarioTimeline)}</span> instead of{' '}
                            {formatMonthsToYears(payoff.baselineTimeline)}, saving{' '}
                            <span className="font-bold text-green-400">{formatCurrency(payoff.interestSaved)}</span> in interest.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <InfoCard
                                title="Total Monthly Payment"
                                value={formatCurrency(payoff.totalMinimumPayment + extraPayment)}
                                subtitle={`${formatCurrency(payoff.totalMinimumPayment)} min + ${formatCurrency(extraPayment)} extra`}
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PayoffDateCard
                                title="Estimated Payoff Time"
                                date={scenarioPayoffDate.date}
                                relative={scenarioPayoffDate.relative}
                                subtitle={`vs. ${baselinePayoffDate.date} without extra payments`}
                            />
                            <InfoCard
                                title="Estimated Time Saved"
                                value={formatMonthsToYears(timeSavedMonths)}
                                valueClass="text-green-400"
                                subtitle="with extra payments"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <InfoCard
                                title="Total Interest Paid"
                                value={formatCurrency(payoff.scenarioInterestPaid)}
                                subtitle={`vs. ${formatCurrency(payoff.baselineInterestPaid)}`}
                            />
                            <InfoCard
                                title="Interest Saved"
                                value={formatCurrency(payoff.interestSaved)}
                                valueClass="text-green-400"
                                subtitle="with extra payments"
                            />
                        </div>
                    </div>

                    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                        <h2 className="text-xl font-semibold mb-1">Payoff Timeline</h2>
                        <p className="text-sm text-dark-text-secondary mb-4">Shows your total debt balance decreasing over time.</p>
                        <div style={{ width: '100%', height: 300 }}>
                            <ResponsiveContainer>
                                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" />
                                    <XAxis dataKey="month" stroke="#a0aec0" label={{ value: 'Months', position: 'insideBottom', offset: -5 }} />
                                    <YAxis stroke="#a0aec0" tickFormatter={(value) => formatCurrency(value)} width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#2d3748', border: '1px solid #4a5568' }}
                                        formatter={(value: number) => [formatCurrency(value), 'Remaining Debt']}
                                        labelFormatter={(label) => `Month ${label}`}
                                    />
                                    <Bar dataKey="Remaining Debt" fill="#00f5d4" name="Remaining Debt" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <LoanTrellisChart
                        loans={finances.loans}
                        steps={payoff.steps}
                        totalMinimumPayment={payoff.totalMinimumPayment}
                    />

                    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
                        <h2 className="text-xl font-semibold mb-4">Payoff Order (Avalanche Method)</h2>
                        <ul className="space-y-4">
                            {sortedLoans.map((loan, index) => {
                                const minPmt = getEffectiveMinPayment(loan);
                                return (
                                    <li key={loan.id} className="p-4 bg-gray-900/50 rounded-md flex justify-between items-center gap-4">
                                        <div className="flex items-center">
                                            <span className="text-lg font-bold text-accent mr-4">{index + 1}.</span>
                                            <div>
                                                <p className="font-semibold">{loan.name}</p>
                                                <p className="text-sm text-dark-text-secondary">APR: {loan.apr}% | Balance: {formatCurrency(loan.balance)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <p className="font-semibold">{formatCurrency(minPmt)}</p>
                                            <p className="text-sm text-dark-text-secondary">
                                                {loan.minPaymentOverride !== undefined ? 'Custom Min.' : 'Min. Payment'}
                                            </p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

interface InfoCardProps {
    title: string;
    value: string;
    subtitle: string;
    valueClass?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, value, subtitle, valueClass = 'text-dark-text' }) => (
    <div className="bg-dark-card p-5 rounded-lg border border-dark-border">
        <h3 className="text-sm text-dark-text-secondary">{title}</h3>
        <p className={`text-2xl font-bold mt-1 ${valueClass}`}>{value}</p>
        <p className="text-xs text-dark-text-secondary mt-1">{subtitle}</p>
    </div>
);

interface PayoffDateCardProps {
    title: string;
    date: string;
    relative: string;
    subtitle: string;
}

const PayoffDateCard: React.FC<PayoffDateCardProps> = ({ title, date, relative, subtitle }) => (
    <div className="bg-dark-card p-5 rounded-lg border border-dark-border">
        <h3 className="text-sm text-dark-text-secondary">{title}</h3>
        <p className="text-2xl font-bold mt-1 text-dark-text">{date}</p>
        <p className="text-sm font-medium text-accent mt-0.5">{relative} from now</p>
        <p className="text-xs text-dark-text-secondary mt-1">{subtitle}</p>
    </div>
);

export default PayoffPlanPage;
