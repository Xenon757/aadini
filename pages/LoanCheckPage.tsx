import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinance } from '../contexts/FinanceContext';
import { Loan, LoanType } from '../types';
import { DTI_THRESHOLDS } from '../constants';
import { calculateMinimumPayment } from '../services/loanCalculator';
import TermCombobox from '../components/TermCombobox';

const LoanCheckPage: React.FC = () => {
    const navigate = useNavigate();
    const { finances, setFinances, monthlyDebtPayments, monthlyExpensesTotal, settings } = useFinance();
    const [newLoan, setNewLoan] = useState<Omit<Loan, 'id' | 'originalAmount'>>({
        name: 'New Loan',
        type: LoanType.CreditCard,
        balance: 10000,
        apr: 7.5,
        term: 8,
    });
    const [result, setResult] = useState<{ recommendation: string; newDti: number; explanation: string } | null>(null);
    const [minOverride, setMinOverride] = useState<number | undefined>(undefined);

    const calcMinPayment = useMemo(() => {
        return calculateMinimumPayment(newLoan.balance, newLoan.apr, newLoan.term);
    }, [newLoan]);

    const estMinPayment = minOverride !== undefined ? minOverride : calcMinPayment;

    const isNegAmort = useMemo(() => {
        const monthlyInterest = (newLoan.balance * (newLoan.apr / 100)) / 12;
        return estMinPayment < monthlyInterest;
    }, [newLoan.balance, newLoan.apr, estMinPayment]);

    const handleInputChange = (field: keyof typeof newLoan, value: any) => {
        setNewLoan(prev => ({...prev, [field]: value}));
        setMinOverride(undefined);
        setResult(null);
    };

    const checkAffordability = () => {
        const isUsingNetIncome = finances.monthlyGrossIncome <= 0 && finances.monthlyNetIncome > 0;
        const incomeForDti = isUsingNetIncome ? finances.monthlyNetIncome : finances.monthlyGrossIncome;

        if (incomeForDti <= 0) {
            alert("Please enter your income on the Finances page first.");
            return;
        }

        const newTotalMonthlyDebt = monthlyDebtPayments + estMinPayment;
        const newDti = newTotalMonthlyDebt / incomeForDti;
        const dtiThreshold = DTI_THRESHOLDS[settings.riskProfile];

        // Calculate leftover money with new loan
        const newLeftoverMoney = finances.monthlyNetIncome - monthlyExpensesTotal - newTotalMonthlyDebt;

        let recommendation = '';
        let explanation = '';

        // Check if loan causes DTI to exceed threshold OR leftover money to be negative
        if (newDti > dtiThreshold || newLeftoverMoney < 0) {
            recommendation = 'Not Recommended';
            const reasons = [];
            if (newDti > dtiThreshold) {
                reasons.push(`Your new Debt-to-Income Ratio would be ${(newDti * 100).toFixed(1)}%, which exceeds the recommended ${(dtiThreshold * 100).toFixed(0)}% for your risk profile.`);
            }
            if (newLeftoverMoney < 0) {
                reasons.push(`This loan would leave you with a negative monthly balance of $${newLeftoverMoney.toFixed(2)}.`);
            }
            explanation = `This loan is not recommended. ${reasons.join(' ')}`;
        } else {
            recommendation = 'Safe';
            explanation = `Based on your current finances, this loan appears to be safe. Your new Debt-to-Income Ratio would be ${(newDti * 100).toFixed(1)}%, which is within the recommended ${(dtiThreshold * 100).toFixed(0)}% for your risk profile. You would have $${newLeftoverMoney.toFixed(2)} left over each month.`;
        }

        if (isUsingNetIncome) {
            explanation += ' Note: This calculation is based on your net income as gross income was not provided. DTI is typically calculated with gross income, so this is an approximation.'
        }

        setResult({ recommendation, newDti, explanation });
    };

    const addLoanToFinances = () => {
        const loanToAdd: Loan = {
            ...newLoan,
            id: `loan-${Date.now()}`,
            originalAmount: newLoan.balance,
            ...(minOverride !== undefined ? { minPaymentOverride: minOverride } : {}),
        };
        setFinances(prev => ({ ...prev, loans: [...prev.loans, loanToAdd] }));
        alert("Loan added to your finances!");
        navigate('/finances');
    };

    return (
        <div className="p-6 sm:p-8 max-w-2xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-accent">Loan Affordability Check</h1>
                <p className="text-dark-text-secondary">See if a new loan fits your budget.</p>
            </header>

            <div className="bg-dark-card p-6 sm:p-8 rounded-lg border border-dark-border space-y-6">
                <h2 className="text-xl font-semibold">New Loan Details</h2>
                <div>
                    <label className="text-sm">Loan Name</label>
                    <input type="text" value={newLoan.name} onChange={e => handleInputChange('name', e.target.value)} className="mt-1 w-full bg-dark-bg border-dark-border rounded-md"/>
                </div>
                <div className="grid grid-cols-2 gap-5">
                    <div>
                        <label className="text-sm">Loan Type</label>
                        <select value={newLoan.type} onChange={e => handleInputChange('type', e.target.value as LoanType)} className="mt-1 w-full bg-dark-bg border-dark-border rounded-md">
                            {Object.values(LoanType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm">Term</label>
                        <TermCombobox
                            termYears={newLoan.term}
                            onChange={(termYears) => handleInputChange('term', termYears)}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="text-sm">Loan Amount ($)</label>
                        <input type="number" value={newLoan.balance} onFocus={(e) => e.target.select()} onChange={e => handleInputChange('balance', Number(e.target.value))} className="mt-1 w-full bg-dark-bg border-dark-border rounded-md"/>
                    </div>
                    <div>
                        <label className="text-sm">APR (%)</label>
                        <input type="number" value={newLoan.apr} onFocus={(e) => e.target.select()} onChange={e => handleInputChange('apr', Number(e.target.value))} className="mt-1 w-full bg-dark-bg border-dark-border rounded-md"/>
                    </div>
                </div>
                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-sm">Est. Minimum Required Payment ($)</label>
                        <button
                            type="button"
                            onClick={() => setMinOverride(minOverride !== undefined ? undefined : calcMinPayment)}
                            className="text-xs text-accent hover:text-accent/80 underline transition-colors"
                        >
                            {minOverride !== undefined ? 'Reset to calculated' : 'Override'}
                        </button>
                    </div>
                    {minOverride !== undefined ? (
                        <input
                            type="number"
                            value={minOverride}
                            onFocus={(e) => e.target.select()}
                            onChange={e => { setMinOverride(parseFloat(e.target.value) || 0); setResult(null); }}
                            className="mt-1 w-full bg-dark-bg border-dark-border rounded-md focus:ring-accent focus:border-accent"
                        />
                    ) : (
                        <input type="text" readOnly value={`$${calcMinPayment.toFixed(2)}`} className="mt-1 w-full bg-gray-700 border-dark-border rounded-md"/>
                    )}
                    {minOverride !== undefined && (
                        <p className="text-xs text-dark-text-secondary mt-1">Calculated: ${calcMinPayment.toFixed(2)}</p>
                    )}
                    {isNegAmort && (
                        <div className="mt-2 flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 rounded-md px-3 py-2.5">
                            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                            <p className="text-xs text-amber-300 leading-relaxed">
                                Your minimum payment does not cover the interest you owe. This means your total loan balance will increase every month. To stop your debt from growing, we recommend paying at least the full monthly interest, making extra principal payments, or switching to a fixed-rate loan.
                            </p>
                        </div>
                    )}
                </div>
                <button onClick={checkAffordability} className="w-full bg-accent text-dark-bg font-bold py-2 px-4 rounded-lg hover:bg-accent-hover transition-colors mt-2">
                    Check Affordability
                </button>
            </div>

            {result && (
                <div className="mt-8 bg-dark-card p-6 sm:p-8 rounded-lg border border-dark-border">
                    <h2 className={`text-2xl font-bold ${result.recommendation === 'Not Recommended' ? 'text-red-400' : 'text-green-400'}`}>
                        Result: {result.recommendation}
                    </h2>
                    <p className="text-dark-text-secondary mt-4">{result.explanation}</p>
                    
                    <div className="mt-6 flex flex-wrap items-center gap-4">
                        <button onClick={addLoanToFinances} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                            Add Loan to Finances
                        </button>
                        <button onClick={() => setResult(null)} className="bg-gray-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoanCheckPage;