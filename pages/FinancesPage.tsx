import React, { useState, useMemo } from 'react';
import { useFinance } from '../contexts/FinanceContext';
import { Finances, Expense, Loan, LoanType } from '../types';
import { LOAN_TERMS, EXPENSE_CATEGORIES } from '../constants';
import { computeMonthlyTakeHome, zipToState, getLocalInfo, getStateName, getStateStdDed } from '../services/taxCalculator';
import { PlusCircleIcon, TrashIcon } from '../components/Icons';
import { calculateMinimumPayment, getEffectiveMinPayment } from '../services/loanCalculator';
import TermCombobox from '../components/TermCombobox';
import PlaidLinkButton from '../components/PlaidLinkButton';

const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
    <svg
        className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
);

// ─── Gross Income Section ─────────────────────────────────────────────────────

const LIMIT_401K_ANNUAL = 23_500;
const LIMIT_IRA_ANNUAL  = 7_000;

const GrossIncomeSection: React.FC<{
    finances: Finances;
    onChange: (field: keyof Finances, value: any) => void;
}> = ({ finances, onChange }) => {
    const zip      = finances.zip ?? '';
    const filing   = finances.filingStatus ?? 'single';
    const k401     = finances.monthly401kContribution ?? 0;
    const ira      = finances.annualIraContribution ?? 0;
    const itemized = finances.annualItemizedDeductions ?? 0;

    const grossAnnual    = (finances.monthlyGrossIncome ?? 0) * 12;
    const k401Annual     = k401 * 12;
    const k401LimitEff   = Math.min(LIMIT_401K_ANNUAL, grossAnnual);
    const k401MonthlyMax = k401LimitEff / 12;
    const iraLimitEff    = Math.min(LIMIT_IRA_ANNUAL, Math.max(0, grossAnnual - k401Annual));

    const k401ExceedsIrsLimit  = k401Annual > LIMIT_401K_ANNUAL;
    const k401ExceedsGross     = k401Annual > grossAnnual;
    const iraExceedsIrsLimit   = ira > LIMIT_IRA_ANNUAL;
    const iraExceedsRemaining  = ira > iraLimitEff && !iraExceedsIrsLimit;
    const iraExceedsGross      = ira > Math.max(0, grossAnnual - k401Annual);

    const stateCode = zip.length === 5 ? zipToState(zip) : null;
    const localInfo = zip.length >= 3 ? getLocalInfo(zip) : undefined;
    const zipStatus = zip.length < 5 ? 'idle' : stateCode ? 'valid' : 'invalid';

    const sded = stateCode ? getStateStdDed(stateCode, filing) : null;

    const { takeHome } = useMemo(() =>
        computeMonthlyTakeHome(finances.monthlyGrossIncome, filing, k401, ira, itemized, zip),
        [finances.monthlyGrossIncome, filing, k401, ira, itemized, zip]
    );

    const monthlyNet = stateCode ? takeHome : null;

    const handle401kChange = (raw: number) => {
        const clamped = Math.min(raw, k401MonthlyMax);
        onChange('monthly401kContribution', clamped);
    };

    const handleIraChange = (raw: number) => {
        const clamped = Math.min(raw, iraLimitEff);
        onChange('annualIraContribution', clamped);
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="block text-sm text-dark-text-secondary mb-1">Monthly Gross Income</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-sm pointer-events-none">$</span>
                    <input
                        type="number"
                        value={finances.monthlyGrossIncome}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => onChange('monthlyGrossIncome', parseFloat(e.target.value) || 0)}
                        className="block w-full pl-7 bg-dark-bg border-dark-border rounded-md shadow-sm focus:ring-accent focus:border-accent"
                    />
                </div>
            </div>

            <div className="bg-gray-900/50 p-5 rounded-md border border-dark-border space-y-5">
                <div>
                    <p className="text-xs text-dark-text-secondary mb-0.5">Tax Calculator — 2026 · federal · state · FICA · local</p>
                    <p className="text-xs text-dark-text-secondary">State personal exemptions applied automatically (1 single, 2 married).</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm text-dark-text-secondary mb-1">Filing Status</label>
                        <div className="flex gap-2">
                            {(['single', 'married'] as const).map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => onChange('filingStatus', f)}
                                    className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                                        filing === f
                                            ? 'bg-accent/10 border-accent text-accent'
                                            : 'bg-dark-bg border-dark-border text-dark-text-secondary hover:border-gray-500'
                                    }`}
                                >
                                    {f === 'single' ? 'Single' : 'Married'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-dark-text-secondary mb-1">ZIP Code</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            value={zip}
                            placeholder="e.g. 10001"
                            onChange={(e) => onChange('zip', e.target.value.replace(/\D/g, ''))}
                            className={`block w-full bg-dark-bg rounded-md shadow-sm focus:ring-accent focus:border-accent border ${
                                zipStatus === 'valid'   ? 'border-green-600' :
                                zipStatus === 'invalid' ? 'border-red-500'   : 'border-dark-border'
                            }`}
                        />
                        {zipStatus === 'valid' && (
                            <p className="text-xs text-green-400 mt-1">
                                {getStateName(stateCode!)}
                                {localInfo ? ` · ${localInfo.city} (+${(localInfo.rate * 100).toFixed(2)}% local)` : ''}
                            </p>
                        )}
                        {zipStatus === 'invalid' && (
                            <p className="text-xs text-red-400 mt-1">ZIP not recognized</p>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm text-dark-text-secondary mb-1">
                            Monthly 401(k) Contribution — 2026 limit: ${LIMIT_401K_ANNUAL.toLocaleString()}/yr
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-sm pointer-events-none">$</span>
                            <input
                                type="number"
                                value={k401 || ''}
                                placeholder="0"
                                min={0}
                                max={k401MonthlyMax}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handle401kChange(parseFloat(e.target.value) || 0)}
                                className={`block w-full pl-7 bg-dark-bg rounded-md shadow-sm focus:ring-accent focus:border-accent border ${
                                    k401ExceedsGross || k401ExceedsIrsLimit ? 'border-red-500' : 'border-dark-border'
                                }`}
                            />
                        </div>
                        {k401ExceedsGross && (
                            <p className="text-xs text-red-400 mt-1">Cannot exceed gross income. Capped at ${k401MonthlyMax.toLocaleString('en-US', { maximumFractionDigits: 2 })}/mo.</p>
                        )}
                        {!k401ExceedsGross && k401ExceedsIrsLimit && (
                            <p className="text-xs text-red-400 mt-1">Exceeds IRS limit of ${LIMIT_401K_ANNUAL.toLocaleString()}/yr. Capped at ${(LIMIT_401K_ANNUAL / 12).toLocaleString('en-US', { maximumFractionDigits: 2 })}/mo.</p>
                        )}
                        {!k401ExceedsGross && !k401ExceedsIrsLimit && k401Annual > 0 && (
                            <p className="text-xs text-green-500 mt-1">${k401Annual.toLocaleString()}/yr of ${LIMIT_401K_ANNUAL.toLocaleString()} limit used</p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm text-dark-text-secondary mb-1">
                            Annual IRA Contribution — 2026 limit: ${LIMIT_IRA_ANNUAL.toLocaleString()}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-sm pointer-events-none">$</span>
                            <input
                                type="number"
                                value={ira || ''}
                                placeholder="0"
                                min={0}
                                max={iraLimitEff}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleIraChange(parseFloat(e.target.value) || 0)}
                                className={`block w-full pl-7 bg-dark-bg rounded-md shadow-sm focus:ring-accent focus:border-accent border ${
                                    iraExceedsGross || iraExceedsIrsLimit ? 'border-red-500' : 'border-dark-border'
                                }`}
                            />
                        </div>
                        {iraExceedsGross && (
                            <p className="text-xs text-red-400 mt-1">Cannot exceed remaining gross income after 401(k). Capped at ${iraLimitEff.toLocaleString()}/yr.</p>
                        )}
                        {!iraExceedsGross && iraExceedsIrsLimit && (
                            <p className="text-xs text-red-400 mt-1">Exceeds IRS limit of ${LIMIT_IRA_ANNUAL.toLocaleString()}/yr. Capped at ${LIMIT_IRA_ANNUAL.toLocaleString()}.</p>
                        )}
                        {!iraExceedsGross && iraExceedsRemaining && (
                            <p className="text-xs text-amber-400 mt-1">Capped at ${iraLimitEff.toLocaleString()} — remaining gross after 401(k).</p>
                        )}
                        {!iraExceedsGross && !iraExceedsIrsLimit && !iraExceedsRemaining && ira > 0 && (
                            <p className="text-xs text-green-500 mt-1">${ira.toLocaleString()}/yr of ${LIMIT_IRA_ANNUAL.toLocaleString()} limit used</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-dark-text-secondary mb-1">
                        Annual Itemized Deductions
                        {sded != null ? ` — state std: $${sded.toLocaleString()} · whichever is higher is used` : ''}
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-sm pointer-events-none">$</span>
                        <input
                            type="number"
                            value={itemized || ''}
                            placeholder="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => onChange('annualItemizedDeductions', parseFloat(e.target.value) || 0)}
                            className="block w-full pl-7 bg-dark-bg border-dark-border rounded-md shadow-sm focus:ring-accent focus:border-accent"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-5 pt-2 border-t border-dark-border">
                    <div>
                        <label className="block text-sm text-dark-text-secondary mb-1">Monthly Take-Home Pay</label>
                        <input
                            type="text"
                            readOnly
                            value={monthlyNet != null ? `$${Math.max(0, monthlyNet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                            className="block w-full bg-gray-700 border-dark-border rounded-md"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-dark-text-secondary mb-1">Used as Net Income</label>
                        <input
                            type="text"
                            readOnly
                            value={monthlyNet != null ? `$${Math.max(0, monthlyNet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Enter ZIP to calculate'}
                            className="block w-full bg-gray-700 border-dark-border rounded-md"
                        />
                    </div>
                </div>
                {zipStatus !== 'valid' && (
                    <p className="text-xs text-amber-400">Enter your ZIP code to include state &amp; local taxes in the estimate.</p>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const FinancesPage: React.FC = () => {
    const { finances, setFinances } = useFinance();
    const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

    const handleIncomeChange = (field: keyof Finances, value: any) => {
        setFinances(prev => {
            const next = { ...prev, [field]: value };
            if (next.incomeType === 'gross') {
                const { takeHome, stateCode } = computeMonthlyTakeHome(
                    next.monthlyGrossIncome,
                    next.filingStatus ?? 'single',
                    next.monthly401kContribution ?? 0,
                    next.annualIraContribution ?? 0,
                    next.annualItemizedDeductions ?? 0,
                    next.zip ?? ''
                );
                if (stateCode) next.monthlyNetIncome = Math.max(0, takeHome);
            }
            return next;
        });
    };

    const getCategoryExpenseAmount = (name: string): number => {
        return finances.expenses.find(e => e.name === name)?.amount ?? 0;
    };

    const handleCategoryExpenseChange = (name: string, amount: number) => {
        setFinances(prev => {
            const existing = prev.expenses.find(e => e.name === name);
            if (existing) {
                return { ...prev, expenses: prev.expenses.map(e => e.name === name ? { ...e, amount } : e) };
            }
            return { ...prev, expenses: [...prev.expenses, { id: `cat-${name}`, name, amount }] };
        });
    };

    const handleAddCustomExpense = () => {
        const newExpense: Expense = { id: `expense-${Date.now()}`, name: '', amount: 0 };
        setFinances(prev => ({ ...prev, expenses: [...prev.expenses, newExpense] }));
    };

    const handleCustomExpenseChange = (id: string, field: 'name' | 'amount', value: string | number) => {
        setFinances(prev => ({
            ...prev,
            expenses: prev.expenses.map(exp => exp.id === id ? { ...exp, [field]: value } : exp),
        }));
    };

    const handleRemoveExpense = (id: string) => {
        setFinances(prev => ({ ...prev, expenses: prev.expenses.filter(exp => exp.id !== id) }));
    };

    const toggleCategory = (id: string) => {
        setOpenCategories(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleAddLoan = () => {
        const newLoan: Loan = { id: `loan-${Date.now()}`, name: 'New Loan', type: LoanType.Other, balance: 10000, apr: 5, term: 5, originalAmount: 10000 };
        setFinances(prev => ({ ...prev, loans: [...prev.loans, newLoan] }));
    };

    // Property-tax <-> expense sync for Mortgage loans is handled centrally by
    // FinanceContext's effect (reactive to finances.loans), so this only needs
    // to update the loan itself.
    const handleLoanChange = (id: string, field: keyof Loan, value: any) => {
        setFinances(prev => ({
            ...prev,
            loans: prev.loans.map(loan => {
                if (loan.id === id) {
                    const newLoan = { ...loan, [field]: value };
                    if (field === 'balance') newLoan.originalAmount = value;
                    return newLoan;
                }
                return loan;
            }),
        }));
    };

    const handleRemoveLoan = (id: string) => {
        setFinances(prev => ({
            ...prev,
            loans: prev.loans.filter(loan => loan.id !== id),
            expenses: prev.expenses.filter(exp => exp.id !== `property-tax-${id}`),
        }));
    };

    const getCalculatedMin = (loan: Loan) =>
        calculateMinimumPayment(loan.originalAmount > 0 ? loan.originalAmount : loan.balance, loan.apr, loan.term);

    const isNegativeAmortization = (loan: Loan): boolean => {
        const monthlyInterest = (loan.balance * (loan.apr / 100)) / 12;
        return getEffectiveMinPayment(loan) < monthlyInterest;
    };

    const knownCategoryNames = new Set(EXPENSE_CATEGORIES.flatMap(cat => cat.subcategories.map(s => s.name)));
    const customExpenses = finances.expenses.filter(e =>
        (!knownCategoryNames.has(e.name) && !e.id.startsWith('property-tax-') && !e.id.startsWith('cat-')) || e.id.startsWith('expense-') || e.id.startsWith('plaid-recurring-')
    );

    const allCategoryTotal = EXPENSE_CATEGORIES.reduce((sum, cat) =>
        sum + cat.subcategories.reduce((s, sub) => s + getCategoryExpenseAmount(sub.name), 0), 0
    );

    return (
        <div className="p-6 sm:p-8 max-w-4xl mx-auto">
            <header className="mb-10">
                <h1 className="text-3xl font-bold text-accent">Your Finances</h1>
                <p className="text-dark-text-secondary mt-1">Manage your income, expenses, and loans here.</p>
            </header>

            <div className="space-y-10">
                {/* Income */}
                <div className="bg-dark-card p-6 sm:p-8 rounded-lg border border-dark-border">
                    <h2 className="text-xl font-semibold mb-6">Income & Taxes (Monthly)</h2>
                    <div className="mb-6">
                        <p className="text-sm text-dark-text-secondary mb-2">How do you want to enter your income?</p>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                            <label className="flex items-center">
                                <input type="radio" name="incomeType" value="gross" checked={finances.incomeType === 'gross'} onChange={() => handleIncomeChange('incomeType', 'gross')} className="form-radio text-accent bg-dark-bg focus:ring-accent" />
                                <span className="ml-2">Gross Income (before tax) & Tax Calculation</span>
                            </label>
                            <label className="flex items-center">
                                <input type="radio" name="incomeType" value="net" checked={finances.incomeType === 'net'} onChange={() => handleIncomeChange('incomeType', 'net')} className="form-radio text-accent bg-dark-bg focus:ring-accent" />
                                <span className="ml-2">Net Income (after tax)</span>
                            </label>
                        </div>
                    </div>
                    {finances.incomeType === 'gross' ? (
                        <GrossIncomeSection finances={finances} onChange={handleIncomeChange} />
                    ) : (
                        <div>
                            <label className="block text-sm text-dark-text-secondary mb-1">Monthly Net Income</label>
                            <input
                                type="number"
                                value={finances.monthlyNetIncome}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handleIncomeChange('monthlyNetIncome', parseFloat(e.target.value) || 0)}
                                className="block w-full bg-dark-bg border-dark-border rounded-md shadow-sm focus:ring-accent focus:border-accent"
                            />
                        </div>
                    )}
                </div>

                {/* Monthly Expenses */}
                <div className="bg-dark-card p-6 sm:p-8 rounded-lg border border-dark-border">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold">Monthly Expenses</h2>
                        {allCategoryTotal > 0 && (
                            <span className="text-sm font-medium text-accent">
                                ${allCategoryTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-dark-text-secondary mb-5">Select a category to expand and enter amounts, or enter your own.</p>

                    <div className="space-y-2">
                        {EXPENSE_CATEGORIES.map(category => {
                            const isOpen = openCategories.has(category.id);
                            const catTotal = category.subcategories.reduce((s, sub) => s + getCategoryExpenseAmount(sub.name), 0);
                            return (
                                <div key={category.id} className="border border-dark-border rounded-lg overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => toggleCategory(category.id)}
                                        className="w-full flex items-center justify-between px-5 py-4 bg-dark-bg hover:bg-gray-800/60 transition-colors duration-150 text-left"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="font-medium text-dark-text truncate">{category.label}</span>
                                            {catTotal > 0 && (
                                                <span className="text-xs text-accent font-medium bg-accent/10 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                                    ${catTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}/mo
                                                </span>
                                            )}
                                        </div>
                                        <ChevronIcon open={isOpen} />
                                    </button>
                                    {isOpen && (
                                        <div className="px-5 py-5 bg-gray-900/40 border-t border-dark-border">
                                            {category.id === 'housing' && (
                                                <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2 mb-4">
                                                    Have a mortgage? Enter it in the <strong>Loans</strong> section below — it's a debt, not a typical expense.
                                                </p>
                                            )}
                                            {category.id === 'transportation' && (
                                                <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2 mb-4">
                                                    Have an auto loan? Enter it in the <strong>Loans</strong> section below — it's a debt, not a typical expense.
                                                </p>
                                            )}
                                            {category.id === 'education' && (
                                                <p className="text-xs text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2 mb-4">
                                                    Have a student loan? Enter it in the <strong>Loans</strong> section below — it's a debt, not a typical expense.
                                                </p>
                                            )}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {category.subcategories.map(sub => (
                                                <div key={sub.name}>
                                                    <label className="block text-sm text-dark-text-secondary mb-1">{sub.name}</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-secondary text-sm pointer-events-none">$</span>
                                                        <input
                                                            type="number"
                                                            value={getCategoryExpenseAmount(sub.name) || ''}
                                                            placeholder={sub.placeholder}
                                                            onFocus={(e) => e.target.select()}
                                                            onChange={(e) => handleCategoryExpenseChange(sub.name, parseFloat(e.target.value) || 0)}
                                                            className="block w-full pl-7 bg-dark-bg border-dark-border rounded-md shadow-sm focus:ring-accent focus:border-accent"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-8 border-t border-dark-border pt-8">
                        <h3 className="text-lg font-semibold mb-5">My Own Expenses</h3>
                        <div className="space-y-4">
                            {customExpenses.map(expense => (
                                <div key={expense.id} className="flex gap-3 items-end">
                                    <div className="flex-1">
                                        <label className="block text-sm text-dark-text-secondary mb-1">
                                            Name
                                            {expense.plaidItemId && (
                                                <span className="ml-2 text-xs bg-accent/10 text-accent border border-accent/30 rounded-full px-2 py-0.5">
                                                    🏦 {expense.institutionName ?? 'bank'}
                                                </span>
                                            )}
                                        </label>
                                        <input
                                            type="text"
                                            value={expense.name}
                                            onChange={(e) => handleCustomExpenseChange(expense.id, 'name', e.target.value)}
                                            className="block w-full bg-dark-bg border-dark-border rounded-md"
                                            placeholder="e.g., Pet Insurance"
                                        />
                                    </div>
                                    <div className="w-36">
                                        <label className="block text-sm text-dark-text-secondary mb-1">Amount ($)</label>
                                        <input
                                            type="number"
                                            value={expense.amount || ''}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => handleCustomExpenseChange(expense.id, 'amount', parseFloat(e.target.value) || 0)}
                                            className="block w-full bg-dark-bg border-dark-border rounded-md"
                                            placeholder="0"
                                        />
                                    </div>
                                    <button onClick={() => handleRemoveExpense(expense.id)} className="p-2 mb-0.5 text-red-500 hover:text-red-400">
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleAddCustomExpense}
                            className="mt-5 border-2 border-dashed border-dark-border text-dark-text-secondary w-full py-2.5 rounded-lg hover:bg-dark-border hover:text-dark-text transition flex items-center justify-center gap-2"
                        >
                            <PlusCircleIcon />
                            <span>+ Add Another Expense</span>
                        </button>
                    </div>
                </div>

                {/* Your Loans */}
                <div className="bg-dark-card p-6 sm:p-8 rounded-lg border border-dark-border">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                        <h2 className="text-xl font-semibold">Your Loans</h2>
                        <PlaidLinkButton />
                    </div>
                    <div className="space-y-5">
                        {finances.loans.map(loan => {
                            const calcMin = getCalculatedMin(loan);
                            const hasOverride = loan.minPaymentOverride !== undefined;
                            return (
                                <div key={loan.id} className={`bg-gray-900/50 p-5 rounded-lg border ${isNegativeAmortization(loan) ? 'border-amber-500/60' : 'border-dark-border'}`}>
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <input
                                                type="text"
                                                value={loan.name}
                                                onChange={e => handleLoanChange(loan.id, 'name', e.target.value)}
                                                className="text-lg font-semibold bg-transparent border-0 p-0 focus:ring-0 focus:text-accent"
                                                placeholder="Loan Name"
                                            />
                                            {loan.plaidItemId && (
                                                <span className="flex-shrink-0 text-xs bg-accent/10 text-accent border border-accent/30 rounded-full px-2 py-0.5">
                                                    🏦 {loan.institutionName ?? 'bank'}
                                                </span>
                                            )}
                                        </div>
                                        <button onClick={() => handleRemoveLoan(loan.id)} className="text-red-500 hover:text-red-400">
                                            <TrashIcon />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div>
                                            <label className="text-sm text-dark-text-secondary mb-1 block">Loan Type</label>
                                            <select value={loan.type} onChange={e => handleLoanChange(loan.id, 'type', e.target.value as LoanType)} className="w-full bg-dark-bg border-dark-border rounded-md">
                                                {Object.values(LoanType).map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm text-dark-text-secondary mb-1 block">Original Term</label>
                                            <TermCombobox
                                                termYears={loan.term}
                                                onChange={(termYears) => handleLoanChange(loan.id, 'term', termYears)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-dark-text-secondary mb-1 block">Current Balance ($)</label>
                                            <input type="number" value={loan.balance} onFocus={(e) => e.target.select()} onChange={e => handleLoanChange(loan.id, 'balance', parseFloat(e.target.value) || 0)} className="w-full bg-dark-bg border-dark-border rounded-md" />
                                        </div>
                                        <div>
                                            <label className="text-sm text-dark-text-secondary mb-1 block">APR (%)</label>
                                            <input type="number" value={loan.apr} onFocus={(e) => e.target.select()} onChange={e => handleLoanChange(loan.id, 'apr', parseFloat(e.target.value) || 0)} className="w-full bg-dark-bg border-dark-border rounded-md" />
                                        </div>
                                        {loan.type === LoanType.Mortgage && (
                                            <div>
                                                <label className="text-sm text-dark-text-secondary mb-1 block">Monthly Property Tax ($)</label>
                                                <input
                                                    type="number"
                                                    value={loan.monthlyPropertyTax || 0}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={e => handleLoanChange(loan.id, 'monthlyPropertyTax', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-dark-bg border-dark-border rounded-md"
                                                    placeholder="0"
                                                />
                                            </div>
                                        )}
                                        <div className={loan.type === LoanType.Mortgage ? '' : 'col-span-2'}>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-sm text-dark-text-secondary">Minimum Required Payment</label>
                                                <button
                                                    type="button"
                                                    onClick={() => handleLoanChange(loan.id, 'minPaymentOverride', hasOverride ? undefined : calcMin)}
                                                    className="text-xs text-accent hover:text-accent/80 underline transition-colors"
                                                >
                                                    {hasOverride ? 'Reset to calculated' : 'Override'}
                                                </button>
                                            </div>
                                            {hasOverride ? (
                                                <input
                                                    type="number"
                                                    value={loan.minPaymentOverride}
                                                    onFocus={(e) => e.target.select()}
                                                    onChange={e => handleLoanChange(loan.id, 'minPaymentOverride', parseFloat(e.target.value) || 0)}
                                                    className="w-full bg-dark-bg border-dark-border rounded-md focus:ring-accent focus:border-accent"
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    readOnly
                                                    value={`$${calcMin.toFixed(2)}`}
                                                    className="w-full bg-gray-700 border-dark-border rounded-md"
                                                    title="Automatically calculated. Click Override to set a custom value."
                                                />
                                            )}
                                            {hasOverride && (
                                                <p className="text-xs text-dark-text-secondary mt-1">Calculated: ${calcMin.toFixed(2)}</p>
                                            )}
                                        </div>
                                    </div>
                                    {isNegativeAmortization(loan) && (
                                        <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 rounded-md px-3 py-2.5">
                                            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                                            <p className="text-xs text-amber-300 leading-relaxed">
                                                Your minimum payment does not cover the interest you owe. This means your total loan balance will increase every month. To stop your debt from growing, we recommend paying at least the full monthly interest, making extra principal payments, or switching to a fixed-rate loan.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={handleAddLoan} className="mt-6 border-2 border-dashed border-dark-border text-dark-text-secondary w-full py-2 rounded-lg hover:bg-dark-border hover:text-dark-text transition flex items-center justify-center gap-2">
                        <PlusCircleIcon />
                        <span>Add Another Loan</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FinancesPage;
