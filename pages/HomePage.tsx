import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { DTI_THRESHOLDS } from '../constants';
import { PencilIcon, ArrowRightIcon, PlusCircleIcon, ExclamationTriangleIcon, InformationCircleSolidIcon } from '../components/Icons';
import { calculateAvalanchePayoff } from '../services/loanCalculator';
import IncomeExpensesChart from '../components/IncomeExpensesChart';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { 
        finances, 
        monthlyExpensesTotal, 
        monthlyDebtPayments,
        monthlyLeftoverMoney,
        debtToIncomeRatio,
        totalDebt,
        totalAssets,
        netWorth,
        settings
    } = useFinance();

    const payoffProjection = useMemo(() => {
        // Calculate potential savings by applying all leftover money as an extra payment.
        const potentialExtraPayment = Math.max(0, monthlyLeftoverMoney);
        return calculateAvalanchePayoff(finances.loans, potentialExtraPayment);
    }, [finances.loans, monthlyLeftoverMoney]);

    const dtiThreshold = DTI_THRESHOLDS[settings.riskProfile];
    const isDtiHigh = debtToIncomeRatio > dtiThreshold;
    const isLeftoverNegative = monthlyLeftoverMoney < 0;
    const isDtiApproximated = finances.monthlyGrossIncome <= 0 && finances.monthlyNetIncome > 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(value);
    };
    
    const formatMonthsToYears = (totalMonths: number) => {
        if (totalMonths <= 0 || !isFinite(totalMonths)) return 'N/A';
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        if (years > 0 && months > 0) return `${years}y ${months}m`;
        if (years > 0) return `${years} years`;
        return `${months} months`;
    };

    const isPristine = finances.monthlyNetIncome === 0 && monthlyExpensesTotal === 0 && totalDebt === 0;

    // Calculate financial health status
    const leftoverPercentage = finances.monthlyNetIncome > 0 ? (monthlyLeftoverMoney / finances.monthlyNetIncome) : 0;
    const dtiDifference = debtToIncomeRatio - dtiThreshold;

    let financialHealthMessage = '';
    let financialHealthEmoji = '';
    let financialHealthColorScheme = '';

    if (!isPristine) {
        if (debtToIncomeRatio < dtiThreshold && leftoverPercentage >= 0.20) {
            financialHealthMessage = "You're in great financial shape!";
            financialHealthEmoji = "😇";
            financialHealthColorScheme = 'green';
        } else if (dtiDifference > 0.10 || monthlyLeftoverMoney < 0) {
            financialHealthMessage = "We recommend working with a certified credit counselor to restructure debt, negotiate lower rates or hardship programs, and prioritize essential expenses like housing, food, utilities, and transportation, while also considering debt management plans or debt consolidation.";
            financialHealthEmoji = "🤝";
            financialHealthColorScheme = 'red';
        } else {
            financialHealthMessage = "Your current financial situation is stable";
            financialHealthEmoji = "⚖️";
            financialHealthColorScheme = 'neutral';
        }
    }

    return (
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-accent">Modulos Dashboard</h1>
                <p className="text-dark-text-secondary">Your financial overview at a glance.</p>
            </header>

            {isPristine && (
                <div className="bg-dark-card border border-dark-border rounded-lg p-5 mb-8 flex items-start space-x-3">
                    <InformationCircleSolidIcon className="h-5 w-5 text-accent flex-shrink-0 mt-0.5"/>
                    <div>
                        <h3 className="font-semibold">Welcome to Modulos!</h3>
                        <p className="text-sm text-dark-text-secondary">Start by adding your income and existing debts on the Finances page to see your dashboard.</p>
                    </div>
                </div>
            )}

            {!isPristine && financialHealthMessage && (
                <div className={`rounded-lg p-5 mb-8 flex items-start space-x-3 ${
                    financialHealthColorScheme === 'green' ? 'bg-green-900/30 border border-green-500/50' :
                    financialHealthColorScheme === 'red' ? 'bg-red-900/30 border border-red-500/50' :
                    'bg-dark-card border border-dark-border'
                }`}>
                    <div className="text-2xl flex-shrink-0">{financialHealthEmoji}</div>
                    <div>
                        <p className={`text-base font-medium ${
                            financialHealthColorScheme === 'green' ? 'text-green-300' :
                            financialHealthColorScheme === 'red' ? 'text-red-300' :
                            'text-dark-text'
                        }`}>{financialHealthMessage}</p>
                    </div>
                </div>
            )}

            <div className="mb-8">
                <IncomeExpensesChart history={finances.incomeExpenseHistory ?? []} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <DashboardCard title="Monthly Debt Payments" value={formatCurrency(monthlyDebtPayments)} onView={() => navigate('/payoff-plan')} />
                <DashboardCard title="Est. Payoff Time" value={formatMonthsToYears(payoffProjection.baselineTimeline)} onView={() => navigate('/payoff-plan')} />
                <DashboardCard title="Projected Savings" value={formatCurrency(payoffProjection.interestSaved)} onView={() => navigate('/payoff-plan')} />
                <DashboardCard title="Monthly Leftover Money" value={formatCurrency(monthlyLeftoverMoney)} hasWarning={isLeftoverNegative} />
                <DashboardCard 
                    title="Debt-to-Income Ratio" 
                    value={`${(debtToIncomeRatio * 100).toFixed(1)}%`} 
                    hasWarning={isDtiHigh}
                    tooltip={isDtiApproximated ? "Approximated using net income. DTI is typically calculated with gross income. A healthy DTI ratio is 36% or less" : undefined}
                />
                <DashboardCard title="Total Debt" value={formatCurrency(totalDebt)} onEdit={() => navigate('/finances')} />
                <DashboardCard title="Total Assets" value={formatCurrency(totalAssets)} onEdit={() => navigate('/finances')} />
                <DashboardCard title="Net Worth" value={formatCurrency(netWorth)} hasWarning={netWorth < 0} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ActionCard 
                    title="Add or Edit Finances"
                    description="Add or edit your income, expenses, and loans."
                    buttonText="Add a loan you're paying"
                    onClick={() => navigate('/finances')}
                />
                <ActionCard 
                    title="Check a New Loan"
                    description="Determine if you should take another loan."
                    buttonText="Check a New Loan"
                    onClick={() => navigate('/loan-check')}
                />
            </div>
        </div>
    );
};

interface DashboardCardProps {
    title: string;
    value: string;
    onEdit?: () => void;
    onView?: () => void;
    hasWarning?: boolean;
    tooltip?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, onEdit, onView, hasWarning, tooltip }) => {
    const hasAction = onEdit || onView;
    const handleClick = () => {
        if (onEdit) onEdit();
        else if (onView) onView();
    };

    return (
        <div
            className={`bg-dark-card p-5 rounded-lg border border-dark-border flex flex-col justify-between ${
                hasAction ? 'cursor-pointer hover:border-accent transition-colors' : ''
            }`}
            onClick={hasAction ? handleClick : undefined}
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                    <h3 className="text-dark-text-secondary">{title}</h3>
                    {tooltip && (
                        <div className="relative group" tabIndex={0}>
                            <InformationCircleSolidIcon className="h-4 w-4 text-dark-text-secondary cursor-pointer" />
                            <div
                                role="tooltip"
                                className="absolute bottom-full mb-2 w-max max-w-xs p-3 text-sm text-dark-text bg-dark-bg border border-dark-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-300 pointer-events-none -translate-x-1/2 left-1/2 z-10"
                            >
                                {tooltip}
                            </div>
                        </div>
                    )}
                </div>
                {onEdit && <PencilIcon className="h-5 w-5 text-dark-text-secondary" />}
                {onView && <ArrowRightIcon className="h-5 w-5 text-dark-text-secondary" />}
            </div>
            <div className="flex items-center space-x-2 mt-2">
               {hasWarning && <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />}
               <p className={`text-3xl font-semibold ${hasWarning ? 'text-red-400' : 'text-dark-text'}`}>{value}</p>
            </div>
        </div>
    );
};

interface ActionCardProps {
    title: string;
    description: string;
    buttonText: string;
    onClick: () => void;
}

const ActionCard: React.FC<ActionCardProps> = ({ title, description, buttonText, onClick }) => (
    <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-dark-text-secondary mb-6">{description}</p>
        <button 
            onClick={onClick}
            className="w-full bg-accent text-dark-bg font-bold py-2 px-4 rounded-lg flex items-center justify-center space-x-2 hover:bg-accent-hover transition-colors"
        >
            <PlusCircleIcon />
            <span>{buttonText}</span>
        </button>
    </div>
);

export default HomePage;