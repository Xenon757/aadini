import React, { createContext, useContext, useMemo, useEffect } from 'react';
import useSupabaseStorage from '../hooks/useSupabaseStorage';
import { Finances, Settings, RiskProfile, Expense, LoanType } from '../types';
import { calculateMinimumPayment } from '../services/loanCalculator';
import { STANDARD_EXPENSES } from '../constants';

interface FinanceContextType {
    finances: Finances;
    setFinances: React.Dispatch<React.SetStateAction<Finances>>;
    settings: Settings;
    setSettings: React.Dispatch<React.SetStateAction<Settings>>;
    monthlyDebtPayments: number;
    totalDebt: number;
    monthlyExpensesTotal: number;
    monthlyLeftoverMoney: number;
    debtToIncomeRatio: number;
    loading: boolean;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const initialFinances = useMemo<Finances>(() => {
        const initialStandardExpenses: Expense[] = STANDARD_EXPENSES.map(name => ({ id: name, name, amount: 0 }));
        return {
            incomeType: 'net',
            monthlyGrossIncome: 0,
            monthlyNetIncome: 0,
            filingStatus: 'single',
            zip: '',
            expenses: initialStandardExpenses,
            loans: [],
            monthly401kContribution: 0,
            annualIraContribution: 0,
            annualItemizedDeductions: 0,
        };
    }, []);

    const initialSettings = useMemo<Settings>(() => ({
        riskProfile: RiskProfile.Average,
    }), []);

    const [finances, setFinances, financesLoading] = useSupabaseStorage<Finances>('finances', initialFinances, 'user_finances');
    const [settings, setSettings, settingsLoading] = useSupabaseStorage<Settings>('settings', initialSettings, 'user_settings');

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

    const { monthlyDebtPayments, totalDebt, monthlyExpensesTotal, monthlyLeftoverMoney, debtToIncomeRatio } = useMemo(() => {
        const totalDebt = finances.loans.reduce((acc, loan) => acc + loan.balance, 0);
        
        const monthlyDebtPayments = finances.loans.reduce((acc, loan) => {
            const pmt = calculateMinimumPayment(loan.originalAmount > 0 ? loan.originalAmount : loan.balance, loan.apr, loan.term);
            return acc + pmt;
        }, 0);
        
        const monthlyExpensesTotal = finances.expenses.reduce((acc, expense) => acc + expense.amount, 0);
        
        const monthlyLeftoverMoney = finances.monthlyNetIncome - monthlyExpensesTotal - monthlyDebtPayments;

        const incomeForDti = finances.monthlyGrossIncome > 0 ? finances.monthlyGrossIncome : finances.monthlyNetIncome;
        const debtToIncomeRatio = incomeForDti > 0 
            ? (monthlyDebtPayments / incomeForDti) 
            : 0;

        return {
            monthlyDebtPayments,
            totalDebt,
            monthlyExpensesTotal,
            monthlyLeftoverMoney,
            debtToIncomeRatio,
        };
    }, [finances]);

    const loading = financesLoading || settingsLoading;

    const value = {
        finances,
        setFinances,
        settings,
        setSettings,
        monthlyDebtPayments,
        totalDebt,
        monthlyExpensesTotal,
        monthlyLeftoverMoney,
        debtToIncomeRatio,
        loading,
    };

    return (
        <FinanceContext.Provider value={value}>
            {children}
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