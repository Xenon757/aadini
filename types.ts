
export interface Loan {
    id: string;
    name: string;
    type: LoanType;
    balance: number;
    apr: number;
    term: number; // in years
    originalAmount: number;
    monthlyPropertyTax?: number;
    minPaymentOverride?: number;
    /** Set when imported via Plaid; links the loan to a connected bank. */
    plaidItemId?: string;
    institutionName?: string;
}

export interface Expense {
    id: string;
    name:string;
    amount: number;
    /** Set when imported via Plaid; links the expense to a connected bank. */
    plaidItemId?: string;
    institutionName?: string;
}

export enum AssetType {
    Cash = "Cash",
    Retirement = "Retirement",
    Investment = "Investment",
    RealEstate = "Real Estate",
    Vehicle = "Vehicle",
    Other = "Other",
}

/** Something owned (cash, retirement, home value...). Counts toward net worth. */
export interface Asset {
    id: string;
    name: string;
    type: AssetType;
    value: number;
    /** Set when imported via Plaid; links the asset to a connected bank. */
    plaidItemId?: string;
    institutionName?: string;
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

/** A recorded monthly total of net income and expenses, keyed by 'YYYY-MM'. */
export interface MonthlyFinanceSnapshot {
    month: string; // 'YYYY-MM'
    income: number;
    expenses: number;
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
    /** Optional for records saved before assets existed; treat missing as []. */
    assets?: Asset[];
    /** Rolling history of the last 12 months of income vs. expenses. */
    incomeExpenseHistory?: MonthlyFinanceSnapshot[];
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
