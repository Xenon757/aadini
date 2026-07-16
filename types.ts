
export interface Loan {
    id: string;
    name: string;
    type: LoanType;
    balance: number;
    apr: number;
    term: number; // in years
    originalAmount: number;
    monthlyPropertyTax?: number;
}

export interface Expense {
    id: string;
    name:string;
    amount: number;
}

export enum LoanType {
    CreditCard = "Credit Card",
    Mortgage = "Mortgage",
    Auto = "Auto",
    Student = "Student",
    Other = "Other",
}

export enum RiskProfile {
    Low = 'Low',
    Average = 'Average',
    High = 'High',
}

export interface Finances {
    incomeType: 'gross' | 'net';
    monthlyGrossIncome: number;
    monthlyNetIncome: number;
    filingStatus: 'single' | 'married';
    zip: string;
    monthly401kContribution: number;
    annualIraContribution: number;
    annualItemizedDeductions: number;
    expenses: Expense[];
    loans: Loan[];
}

export interface Settings {
    riskProfile: RiskProfile;
}

export type FilingStatus = 'single' | 'married';

export interface PayoffStep {
    month: number;
    year: number;
    totalPayment: number;
    totalInterestPaid: number;
    remainingBalance: number;
    payments: { loanId: string, payment: number, interest: number, principal: number, balance: number, minPayment?: number, extraPayment?: number }[];
}
