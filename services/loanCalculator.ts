import { Loan, PayoffStep } from '../types';

/**
 * Calculates the monthly payment for a loan using the PMT formula.
 * @param principal - The total loan amount.
 * @param annualRate - The annual interest rate (e.g., 5 for 5%).
 * @param termInYears - The loan term in years.
 * @returns The monthly payment amount.
 */
export const calculateMinimumPayment = (principal: number, annualRate: number, termInYears: number): number => {
    if (principal <= 0 || annualRate < 0 || termInYears <= 0) {
        return 0;
    }
    const monthlyRate = (annualRate / 100) / 12;
    const numberOfPayments = termInYears * 12;

    if (monthlyRate === 0) {
        return principal / numberOfPayments;
    }

    const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    return isNaN(payment) || !isFinite(payment) ? 0 : payment;
};

const runPayoffSimulation = (
    loans: Loan[], 
    totalMonthlyPayment: number
): { months: number; totalInterestPaid: number; steps: PayoffStep[] } => {
    
    const sortedLoans = [...loans].sort((a, b) => b.apr - a.apr);
    
    let currentBalances = sortedLoans.reduce((acc, loan) => {
        acc[loan.id] = loan.balance;
        return acc;
    }, {} as { [key: string]: number });

    const minPayments = sortedLoans.reduce((acc, loan) => {
        acc[loan.id] = loan.minPaymentOverride !== undefined
            ? loan.minPaymentOverride
            : calculateMinimumPayment(loan.originalAmount > 0 ? loan.originalAmount : loan.balance, loan.apr, loan.term);
        return acc;
    }, {} as { [key: string]: number });

    let months = 0;
    let totalInterestPaid = 0;
    const steps: PayoffStep[] = [];

    while (Object.values(currentBalances).some(b => b > 0.01) && months < 360 * 2) { // 60 year cap
        months++;
        let paymentPool = totalMonthlyPayment;
        let interestThisMonth = 0;
        const paymentsThisMonth: { loanId: string, payment: number }[] = [];

        // 1. Accrue interest on all loans for the month
        for (const loan of sortedLoans) {
            if (currentBalances[loan.id] > 0) {
                const interest = (currentBalances[loan.id] * (loan.apr / 100)) / 12;
                interestThisMonth += interest;
                currentBalances[loan.id] += interest;
            }
        }
        totalInterestPaid += interestThisMonth;

        const minPaidThisMonth: Record<string, number> = {};

        // 2. Pay minimums first
        for (const loan of sortedLoans) {
            if (currentBalances[loan.id] > 0 && paymentPool > 0) {
                const paymentAmount = Math.min(currentBalances[loan.id], minPayments[loan.id], paymentPool);
                currentBalances[loan.id] -= paymentAmount;
                paymentPool -= paymentAmount;
                minPaidThisMonth[loan.id] = paymentAmount;
                paymentsThisMonth.push({ loanId: loan.id, payment: paymentAmount });
            }
        }

        // 3. Apply extra payment (avalanche) to highest APR loans
        for (const loan of sortedLoans) {
             if (currentBalances[loan.id] > 0 && paymentPool > 0) {
                const extraPay = Math.min(paymentPool, currentBalances[loan.id]);
                currentBalances[loan.id] -= extraPay;
                paymentPool -= extraPay;

                const existingPayment = paymentsThisMonth.find(p => p.loanId === loan.id);
                if(existingPayment) {
                    existingPayment.payment += extraPay;
                } else {
                    paymentsThisMonth.push({ loanId: loan.id, payment: extraPay });
                }
             }
        }

        const currentYear = new Date().getFullYear() + Math.floor((new Date().getMonth() + months -1) / 12);
        const currentMonth = (new Date().getMonth() + months -1) % 12;

        steps.push({
            month: currentMonth,
            year: currentYear,
            totalPayment: totalMonthlyPayment - paymentPool,
            totalInterestPaid: interestThisMonth,
            remainingBalance: Object.values(currentBalances).reduce((a, b) => a + b, 0),
            payments: paymentsThisMonth.map(p => {
                const min = minPaidThisMonth[p.loanId] ?? p.payment;
                const extra = Math.max(0, p.payment - min);
                return { ...p, balance: currentBalances[p.loanId] ?? 0, interest: 0, principal: p.payment, minPayment: min, extraPayment: extra };
            })
        });
    }
    
    return { months, totalInterestPaid, steps };
};


export const calculateAvalanchePayoff = (loans: Loan[], extraPayment: number): {
    scenarioTimeline: number;
    scenarioInterestPaid: number;
    interestSaved: number;
    steps: PayoffStep[];
    baselineTimeline: number;
    baselineInterestPaid: number;
    totalMinimumPayment: number;
} => {
    if (loans.length === 0) {
        return {
            scenarioTimeline: 0, scenarioInterestPaid: 0, interestSaved: 0,
            steps: [], baselineTimeline: 0, baselineInterestPaid: 0, totalMinimumPayment: 0
        };
    }

    const totalMinimumPayment = loans.reduce((acc, loan) => {
        const pmt = loan.minPaymentOverride !== undefined
            ? loan.minPaymentOverride
            : calculateMinimumPayment(loan.originalAmount > 0 ? loan.originalAmount : loan.balance, loan.apr, loan.term);
        return acc + pmt;
    }, 0);

    // Baseline calculation (no extra payment)
    const baselineResult = runPayoffSimulation(loans, totalMinimumPayment);
    
    // Scenario calculation (with extra payment)
    const scenarioTotalPayment = totalMinimumPayment + extraPayment;
    const scenarioResult = runPayoffSimulation(loans, scenarioTotalPayment);

    const interestSaved = baselineResult.totalInterestPaid - scenarioResult.totalInterestPaid;
    
    return {
        scenarioTimeline: scenarioResult.months,
        scenarioInterestPaid: scenarioResult.totalInterestPaid,
        interestSaved: Math.max(0, interestSaved),
        steps: scenarioResult.steps,
        baselineTimeline: baselineResult.months,
        baselineInterestPaid: baselineResult.totalInterestPaid,
        totalMinimumPayment,
    };
};
