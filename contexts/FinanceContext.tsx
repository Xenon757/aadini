import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import useAmplifyStorage from '../hooks/useAmplifyStorage';
import { useAuth } from './AuthContext';
import { Finances, Settings, RiskProfile, Expense, LoanType } from '../types';
import { getEffectiveMinPayment } from '../services/loanCalculator';
import { STANDARD_EXPENSES } from '../constants';
import { createSampleFinances, createSampleSettings } from '../services/sampleData';
import ImportGuestDataModal from '../components/ImportGuestDataModal';

interface FinanceContextType {
    finances: Finances;
    setFinances: React.Dispatch<React.SetStateAction<Finances>>;
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    monthlyDebtPayments: number;
    totalDebt: number;
    totalAssets: number;
    netWorth: number;
    monthlyExpensesTotal: number;
    monthlyLeftoverMoney: number;
    debtToIncomeRatio: number;
    loading: boolean;
    deleteAllData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, isGuest, isSample } = useAuth();

    const initialFinances = useMemo<Finances>(() => {
        if (isSample) return createSampleFinances();
        const initialStandardExpenses: Expense[] = STANDARD_EXPENSES.map(name => ({ id: name, name, amount: 0 }));
        return {
            incomeType: 'net',
            monthlyGrossIncome: 0,
            monthlyNetIncome: 0,
            filingStatus: 'single',
            zip: '',
            expenses: initialStandardExpenses,
            loans: [],
            assets: [],
            monthly401kContribution: 0,
            annualIraContribution: 0,
            annualItemizedDeductions: 0,
            incomeExpenseHistory: [],
        };
    }, [isSample]);

    const initialSettings = useMemo<Settings>(() => (
        isSample ? createSampleSettings() : { riskProfile: RiskProfile.Average }
    ), [isSample]);

    const [finances, setFinances, financesLoading, deleteRemoteFinances] = useAmplifyStorage<Finances>('finances', initialFinances, 'Finances', ['expenses', 'loans', 'assets', 'incomeExpenseHistory']);
    const [settings, setSettings, settingsLoading, deleteRemoteSettings] = useAmplifyStorage<Settings>('settings', initialSettings, 'Settings');

    // Guest data is never silently discarded on sign-in: if guest_finances/guest_settings
    // exist in localStorage once a real user is signed in, always ask before either
    // merging them into the account or clearing them.
    const [importPrompt, setImportPrompt] = useState<{ guestFinances: Finances | null; guestSettings: Settings | null } | null>(null);
    const reconciledUserRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user || isGuest) return;
        if (reconciledUserRef.current === user.userId) return;
        reconciledUserRef.current = user.userId;

        const guestFinancesRaw = localStorage.getItem('guest_finances');
        const guestSettingsRaw = localStorage.getItem('guest_settings');
        if (!guestFinancesRaw && !guestSettingsRaw) return;

        setImportPrompt({
            guestFinances: guestFinancesRaw ? JSON.parse(guestFinancesRaw) : null,
            guestSettings: guestSettingsRaw ? JSON.parse(guestSettingsRaw) : null,
        });
    }, [user?.userId, isGuest]);

    const resolveImportPrompt = (choice: 'import' | 'discard') => {
        if (choice === 'import' && importPrompt) {
            if (importPrompt.guestFinances) setFinances(importPrompt.guestFinances);
            if (importPrompt.guestSettings) setSettings(importPrompt.guestSettings);
        }
        localStorage.removeItem('guest_finances');
        localStorage.removeItem('guest_settings');
        setImportPrompt(null);
    };

    const deleteAllData = async () => {
        if (!isGuest) {
            await Promise.all([deleteRemoteFinances(), deleteRemoteSettings()]);
        }
        localStorage.clear();
    };

    // Migrate old "Housing (Rent/Mortgage)" and "Rent / Mortgage" to "Rent"
    useEffect(() => {
        const needsMigration = finances.expenses.some(
            exp => exp.id === 'Housing (Rent/Mortgage)' || exp.name === 'Rent / Mortgage'
        );
        if (needsMigration) {
            setFinances(prev => ({
                ...prev,
                expenses: prev.expenses.map(exp =>
                    exp.id === 'Housing (Rent/Mortgage)' || exp.name === 'Rent / Mortgage'
                        ? { ...exp, id: exp.id === 'Housing (Rent/Mortgage)' ? 'Rent' : exp.id, name: 'Rent' }
                        : exp
                )
            }));
        }
    }, []);

    // Sync property tax expenses with mortgage loans
    useEffect(() => {
        let needsUpdate = false;
        const updatedExpenses = [...finances.expenses];

        finances.loans.forEach(loan => {
            const propertyTaxExpenseId = `property-tax-${loan.id}`;
            const existingPropertyTaxExpense = updatedExpenses.find(exp => exp.id === propertyTaxExpenseId);

            if (loan.type === LoanType.Mortgage && loan.monthlyPropertyTax && loan.monthlyPropertyTax > 0) {
                if (existingPropertyTaxExpense) {
                    // Update amount if it changed
                    if (existingPropertyTaxExpense.amount !== loan.monthlyPropertyTax) {
                        const index = updatedExpenses.findIndex(exp => exp.id === propertyTaxExpenseId);
                        updatedExpenses[index] = { ...existingPropertyTaxExpense, amount: loan.monthlyPropertyTax };
                        needsUpdate = true;
                    }
                } else {
                    // Add property tax expense
                    updatedExpenses.push({
                        id: propertyTaxExpenseId,
                        name: 'Property Tax',
                        amount: loan.monthlyPropertyTax
                    });
                    needsUpdate = true;
                }
            } else if (existingPropertyTaxExpense) {
                // Remove property tax expense if loan is no longer mortgage or property tax is 0
                const index = updatedExpenses.findIndex(exp => exp.id === propertyTaxExpenseId);
                updatedExpenses.splice(index, 1);
                needsUpdate = true;
            }
        });

        if (needsUpdate) {
            setFinances(prev => ({ ...prev, expenses: updatedExpenses }));
        }
    }, [finances.loans]);

    const { monthlyDebtPayments, totalDebt, totalAssets, netWorth, monthlyExpensesTotal, monthlyLeftoverMoney, debtToIncomeRatio } = useMemo(() => {
        const totalDebt = finances.loans.reduce((acc, loan) => acc + loan.balance, 0);
        
        const totalAssets = (finances.assets ?? []).reduce((acc, asset) => acc + asset.value, 0);

        const monthlyDebtPayments = finances.loans.reduce((acc, loan) => acc + getEffectiveMinPayment(loan), 0);
        
        const monthlyExpensesTotal = finances.expenses.reduce((acc, expense) => acc + expense.amount, 0);
        
        const monthlyLeftoverMoney = finances.monthlyNetIncome - monthlyExpensesTotal - monthlyDebtPayments;

        const incomeForDti = finances.monthlyGrossIncome > 0 ? finances.monthlyGrossIncome : finances.monthlyNetIncome;
        const debtToIncomeRatio = incomeForDti > 0 
            ? (monthlyDebtPayments / incomeForDti) 
            : 0;

        return {
            monthlyDebtPayments,
            totalDebt,
            totalAssets,
            netWorth: totalAssets - totalDebt,
            monthlyExpensesTotal,
            monthlyLeftoverMoney,
            debtToIncomeRatio,
        };
    }, [finances]);

    const loading = financesLoading || settingsLoading;

    // Record a rolling 12-month history of net income vs. expenses. The current
    // calendar month's entry is upserted whenever the underlying totals change,
    // so the breakdown chart fills in with real data over time.
    useEffect(() => {
        if (loading) return;
        const income = finances.monthlyNetIncome;
        const expenses = monthlyExpensesTotal;
        // Don't record an empty (pristine) month.
        if (income === 0 && expenses === 0) return;

        const monthKey = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

        setFinances(prev => {
            const history = prev.incomeExpenseHistory ?? [];
            const existing = history.find(h => h.month === monthKey);
            if (existing && existing.income === income && existing.expenses === expenses) {
                return prev; // No change — bail out to avoid a re-render loop.
            }
            const updated = [
                ...history.filter(h => h.month !== monthKey),
                { month: monthKey, income, expenses },
            ]
                .sort((a, b) => a.month.localeCompare(b.month))
                .slice(-12);
            return { ...prev, incomeExpenseHistory: updated };
        });
    }, [finances.monthlyNetIncome, monthlyExpensesTotal, loading, setFinances]);

    const value = {
        finances,
        setFinances,
        settings,
        setSettings,
        monthlyDebtPayments,
        totalDebt,
        totalAssets,
        netWorth,
        monthlyExpensesTotal,
        monthlyLeftoverMoney,
        debtToIncomeRatio,
        loading,
        deleteAllData,
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
            {importPrompt && (
                <ImportGuestDataModal
                    onImport={() => resolveImportPrompt('import')}
                    onDiscard={() => resolveImportPrompt('discard')}
                />
            )}
        </FinanceContext.Provider>
    );
};

export const useFinance = (): FinanceContextType => {
    const context = useContext(FinanceContext);
    if (!context) {
        throw new Error('useFinance must be used within a FinanceProvider');
    }
    return context;
};