/**
 * Pure mapping from Plaid API responses to the app's Loan/Expense shapes
 * (mirrors types.ts — kept structural here since the Lambda bundle should
 * not import frontend modules).
 */
import type {
  LiabilitiesGetResponse,
  TransactionStream,
  AccountBase,
} from 'plaid';

export interface MappedLoan {
  id: string;
  name: string;
  type: 'Credit Card' | 'Mortgage' | 'Auto' | 'Student' | 'Other';
  balance: number;
  apr: number;
  term: number; // years
  originalAmount: number;
  minPaymentOverride?: number;
  plaidItemId: string;
  institutionName?: string;
}

export interface MappedExpense {
  id: string;
  name: string;
  amount: number;
  plaidItemId: string;
  institutionName?: string;
}

const accountName = (account: AccountBase | undefined, fallback: string): string => {
  if (!account) return fallback;
  const mask = account.mask ? ` ••${account.mask}` : '';
  return `${account.name}${mask}`;
};

const yearsUntil = (dateStr: string | null | undefined, min: number, fallback: number): number => {
  if (!dateStr) return fallback;
  const target = new Date(dateStr).getTime();
  if (Number.isNaN(target)) return fallback;
  const years = (target - Date.now()) / (365.25 * 24 * 3600 * 1000);
  return years > 0 ? Math.max(min, Math.ceil(years)) : fallback;
};

const yearsBetween = (start: string | null | undefined, end: string | null | undefined): number | null => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / (365.25 * 24 * 3600 * 1000));
};

export function mapLiabilitiesToLoans(
  response: LiabilitiesGetResponse,
  itemId: string,
  institutionName?: string
): MappedLoan[] {
  const accounts = new Map(response.accounts.map((acc) => [acc.account_id, acc]));
  const loans: MappedLoan[] = [];
  const liabilityAccountIds = new Set<string>();

  for (const credit of response.liabilities.credit ?? []) {
    if (!credit.account_id) continue;
    liabilityAccountIds.add(credit.account_id);
    const account = accounts.get(credit.account_id);
    const purchaseApr =
      credit.aprs.find((a) => a.apr_type === 'purchase_apr') ?? credit.aprs[0];
    const balance = account?.balances.current ?? credit.last_statement_balance ?? 0;
    loans.push({
      id: `plaid-${credit.account_id}`,
      name: accountName(account, 'Credit Card'),
      type: 'Credit Card',
      balance,
      apr: purchaseApr?.apr_percentage ?? 0,
      term: 5,
      originalAmount: balance,
      ...(credit.minimum_payment_amount != null && credit.minimum_payment_amount > 0
        ? { minPaymentOverride: credit.minimum_payment_amount }
        : {}),
      plaidItemId: itemId,
      institutionName,
    });
  }

  for (const mortgage of response.liabilities.mortgage ?? []) {
    if (!mortgage.account_id) continue;
    liabilityAccountIds.add(mortgage.account_id);
    const account = accounts.get(mortgage.account_id);
    const balance = account?.balances.current ?? 0;
    const termFromLabel = mortgage.loan_term
      ? parseInt(mortgage.loan_term, 10)
      : NaN;
    const term = !Number.isNaN(termFromLabel) && termFromLabel > 0
      ? termFromLabel
      : yearsBetween(mortgage.origination_date, mortgage.maturity_date) ?? 30;
    loans.push({
      id: `plaid-${mortgage.account_id}`,
      name: accountName(account, 'Mortgage'),
      type: 'Mortgage',
      balance,
      apr: mortgage.interest_rate?.percentage ?? 0,
      term,
      originalAmount: mortgage.origination_principal_amount ?? balance,
      ...(mortgage.next_monthly_payment != null && mortgage.next_monthly_payment > 0
        ? { minPaymentOverride: mortgage.next_monthly_payment }
        : {}),
      plaidItemId: itemId,
      institutionName,
    });
  }

  for (const student of response.liabilities.student ?? []) {
    if (!student.account_id) continue;
    liabilityAccountIds.add(student.account_id);
    const account = accounts.get(student.account_id);
    const balance = account?.balances.current ?? 0;
    loans.push({
      id: `plaid-${student.account_id}`,
      name: accountName(account, 'Student Loan'),
      type: 'Student',
      balance,
      apr: student.interest_rate_percentage ?? 0,
      term: yearsUntil(student.expected_payoff_date, 1, 10),
      originalAmount: student.origination_principal_amount ?? balance,
      ...(student.minimum_payment_amount != null && student.minimum_payment_amount > 0
        ? { minPaymentOverride: student.minimum_payment_amount }
        : {}),
      plaidItemId: itemId,
      institutionName,
    });
  }

  // Loan-type accounts with no liability detail object (e.g. auto loans)
  for (const account of response.accounts) {
    if (account.type !== 'loan' || liabilityAccountIds.has(account.account_id)) continue;
    const balance = account.balances.current ?? 0;
    if (balance <= 0) continue;
    const isAuto = account.subtype === 'auto';
    loans.push({
      id: `plaid-${account.account_id}`,
      name: accountName(account, isAuto ? 'Auto Loan' : 'Loan'),
      type: isAuto ? 'Auto' : 'Other',
      balance,
      apr: 0, // Plaid doesn't provide it here; user fills in
      term: 5,
      originalAmount: balance,
      plaidItemId: itemId,
      institutionName,
    });
  }

  return loans;
}

/** Categories that would double-count against loan minimum payments. */
const EXCLUDED_PRIMARY_CATEGORIES = new Set(['LOAN_PAYMENTS', 'TRANSFER_OUT']);

const MONTHLY_FACTOR: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
  UNKNOWN: 1,
};

export function mapRecurringToExpenses(
  outflowStreams: TransactionStream[],
  itemId: string,
  institutionName?: string
): MappedExpense[] {
  const expenses: MappedExpense[] = [];
  for (const stream of outflowStreams) {
    if (!stream.is_active) continue;
    const primary = stream.personal_finance_category?.primary;
    if (primary && EXCLUDED_PRIMARY_CATEGORIES.has(primary)) continue;
    const rawAmount = Math.abs(stream.average_amount?.amount ?? 0);
    if (rawAmount <= 0) continue;
    const factor = MONTHLY_FACTOR[stream.frequency] ?? 1;
    expenses.push({
      id: `plaid-recurring-${stream.stream_id}`,
      name: stream.merchant_name || stream.description || 'Recurring payment',
      amount: Math.round(rawAmount * factor * 100) / 100,
      plaidItemId: itemId,
      institutionName,
    });
  }
  return expenses;
}
