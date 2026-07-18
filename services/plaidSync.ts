import { Finances, Loan, Expense, MonthlyFinanceSnapshot } from '../types';

export interface PlaidImport {
    loans: Loan[];
    expenses: Expense[];
    incomeExpenseHistory: MonthlyFinanceSnapshot[];
}

/**
 * Merges Plaid-imported loans/expenses into the current Finances blob.
 *
 * Merge policy (deliberate — preserves user edits across re-syncs):
 * - Existing imported loan (same plaid- id): always refresh `balance`
 *   (and `originalAmount` when it still tracked the old balance);
 *   refresh `apr`/`minPaymentOverride` only when Plaid supplied a real
 *   value, so a user-corrected APR on an Auto/Other loan is never
 *   clobbered by Plaid's unknown-0. Never touches user-editable
 *   `name`, `type`, `term`, `monthlyPropertyTax`.
 * - Existing imported expense (same plaid-recurring- id): refresh
 *   `amount` only, keep any user-edited name.
 * - New ids are appended. Accounts/streams that vanished from Plaid are
 *   left in place (manual cleanup in v1).
 */
export function mergePlaidData(current: Finances, imported: PlaidImport): Finances {
    const importedLoansById = new Map(imported.loans.map(l => [l.id, l]));
    const importedExpensesById = new Map(imported.expenses.map(e => [e.id, e]));

    const mergedLoans: Loan[] = current.loans.map(loan => {
        const update = importedLoansById.get(loan.id);
        if (!update) return loan;
        importedLoansById.delete(loan.id);
        const next: Loan = {
            ...loan,
            balance: update.balance,
            originalAmount: loan.originalAmount === loan.balance ? update.balance : loan.originalAmount,
            plaidItemId: update.plaidItemId,
            institutionName: update.institutionName ?? loan.institutionName,
        };
        if (update.apr > 0) next.apr = update.apr;
        if (update.minPaymentOverride !== undefined && update.minPaymentOverride > 0) {
            next.minPaymentOverride = update.minPaymentOverride;
        }
        return next;
    });
    mergedLoans.push(...importedLoansById.values());

    const mergedExpenses: Expense[] = current.expenses.map(expense => {
        const update = importedExpensesById.get(expense.id);
        if (!update) return expense;
        importedExpensesById.delete(expense.id);
        return {
            ...expense,
            amount: update.amount,
            plaidItemId: update.plaidItemId,
            institutionName: update.institutionName ?? expense.institutionName,
        };
    });
    mergedExpenses.push(...importedExpensesById.values());

    // Plaid's transaction-derived history is authoritative for the 12 months it
    // covers, so replace wholesale when present; otherwise keep what we have
    // (e.g. transactions weren't ready yet, or a manual-only user's snapshots).
    const incomeExpenseHistory =
        imported.incomeExpenseHistory.length > 0
            ? imported.incomeExpenseHistory
            : current.incomeExpenseHistory;

    return { ...current, loans: mergedLoans, expenses: mergedExpenses, incomeExpenseHistory };
}

/**
 * Removes the Plaid link (badge/association) from loans and expenses of a
 * disconnected bank, keeping the data itself (keep-but-unlink policy).
 */
export function unlinkPlaidItem(current: Finances, itemId: string): Finances {
    const stripLoan = (loan: Loan): Loan => {
        if (loan.plaidItemId !== itemId) return loan;
        const { plaidItemId, institutionName, ...rest } = loan;
        return rest;
    };
    const stripExpense = (expense: Expense): Expense => {
        if (expense.plaidItemId !== itemId) return expense;
        const { plaidItemId, institutionName, ...rest } = expense;
        return rest;
    };
    return {
        ...current,
        loans: current.loans.map(stripLoan),
        expenses: current.expenses.map(stripExpense),
    };
}

/**
 * Parses the JSON payloads returned by the syncPlaidData mutation.
 * AWSJSON values can arrive as arrays or as (possibly double-)encoded
 * JSON strings depending on how many serialization layers applied —
 * unwrap string layers until we hit a non-string.
 */
export function parseSyncResult(result: { loans?: unknown; expenses?: unknown; incomeExpenseHistory?: unknown } | null | undefined): PlaidImport {
    const parse = <T,>(value: unknown): T[] => {
        let v = value;
        for (let depth = 0; depth < 3 && typeof v === 'string'; depth++) {
            try {
                v = JSON.parse(v);
            } catch {
                return [];
            }
        }
        return Array.isArray(v) ? v : [];
    };
    return {
        loans: parse<Loan>(result?.loans),
        expenses: parse<Expense>(result?.expenses),
        incomeExpenseHistory: parse<MonthlyFinanceSnapshot>(result?.incomeExpenseHistory),
    };
}
