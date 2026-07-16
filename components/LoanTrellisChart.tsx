import React from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Loan, PayoffStep } from '../types';

interface LoanChartData {
    month: number;
    balance: number;
    payment: number;
    minPayment: number;
    extraPayment: number;
}

interface LoanTrellisChartProps {
    loans: Loan[];
    steps: PayoffStep[];
    totalMinimumPayment: number;
    startDate?: Date;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const CHART_COLORS = ['#00f5d4', '#38bdf8', '#fb923c', '#a3e635', '#f472b6', '#facc15', '#c084fc', '#34d399'];

const CustomTooltip: React.FC<{
    active?: boolean;
    payload?: any[];
    label?: any;
    loanName: string;
}> = ({ active, payload, label, loanName }) => {
    if (!active || !payload || payload.length === 0) return null;
    const balance = payload.find((p: any) => p.dataKey === 'balance');
    const minPmt = payload.find((p: any) => p.dataKey === 'minPayment');
    const extraPmt = payload.find((p: any) => p.dataKey === 'extraPayment');
    return (
        <div className="bg-gray-800 border border-gray-600 rounded-md p-3 text-xs shadow-lg">
            <p className="font-semibold text-white mb-1.5">{loanName} — Month {label}</p>
            {balance && <p className="text-dark-text-secondary">Balance: <span className="text-white font-medium">{formatCurrency(balance.value)}</span></p>}
            {minPmt && <p className="text-dark-text-secondary">Min. Payment: <span className="text-white font-medium">{formatCurrency(minPmt.value)}</span></p>}
            {extraPmt && extraPmt.value > 0 && <p className="text-dark-text-secondary">Extra Payment: <span className="text-green-400 font-medium">+{formatCurrency(extraPmt.value)}</span></p>}
        </div>
    );
};

const formatPayoffLabel = (payoffMonth: number, startDate: Date): string => {
    const payoff = new Date(startDate.getFullYear(), startDate.getMonth() + payoffMonth, 1);
    const dd = String(payoff.getDate()).padStart(2, '0');
    const mm = String(payoff.getMonth() + 1).padStart(2, '0');
    const yyyy = payoff.getFullYear();
    return `Paid off ${dd}/${mm}/${yyyy} (Month ${payoffMonth})`;
};

const SingleLoanChart: React.FC<{
    loan: Loan;
    data: LoanChartData[];
    color: string;
    payoffMonth: number;
    startDate: Date;
}> = ({ loan, data, color, payoffMonth, startDate }) => {
    const maxBalance = Math.max(...data.map(d => d.balance));
    const hasExtra = data.some(d => d.extraPayment > 0);

    return (
        <div className="bg-gray-900/50 rounded-lg border border-dark-border p-4">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-dark-text truncate pr-2">{loan.name}</h3>
                <span className="text-xs text-dark-text-secondary whitespace-nowrap flex-shrink-0">
                    {loan.apr}% APR · {payoffMonth > 0 ? formatPayoffLabel(payoffMonth, startDate) : '—'}
                </span>
            </div>
            <p className="text-xs text-dark-text-secondary mb-3">
                Start: {formatCurrency(loan.balance)}
            </p>
            <div style={{ width: '100%', height: 180 }}>
                <ResponsiveContainer>
                    <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id={`grad-${loan.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                            dataKey="month"
                            stroke="#6b7280"
                            tick={{ fontSize: 10 }}
                            label={{ value: 'Month', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 10 }}
                        />
                        <YAxis
                            stroke="#6b7280"
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`}
                            width={48}
                            domain={[0, maxBalance * 1.05]}
                        />
                        <Tooltip content={<CustomTooltip loanName={loan.name} />} />
                        {payoffMonth > 0 && (
                            <ReferenceLine x={payoffMonth} stroke="#4b5563" strokeDasharray="4 4" />
                        )}
                        <Area
                            type="monotone"
                            dataKey="balance"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#grad-${loan.id})`}
                            dot={false}
                            activeDot={{ r: 3 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-dark-text-secondary">
                    <span className="inline-block w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
                    Balance
                </span>
                {hasExtra && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                        <span className="inline-block w-3 h-0.5 rounded bg-green-400" />
                        includes extra payment
                    </span>
                )}
            </div>
        </div>
    );
};

const LoanTrellisChart: React.FC<LoanTrellisChartProps> = ({ loans, steps, startDate }) => {
    if (loans.length === 0 || steps.length === 0) return null;

    const effectiveStartDate = startDate ?? new Date();

    const loanDataMap: Record<string, LoanChartData[]> = {};
    const loanPayoffMonth: Record<string, number> = {};

    for (const loan of loans) {
        loanDataMap[loan.id] = [];
        loanDataMap[loan.id].push({ month: 0, balance: loan.balance, payment: 0, minPayment: 0, extraPayment: 0 });
    }

    steps.forEach((step, idx) => {
        const monthNum = idx + 1;
        for (const loan of loans) {
            const paymentEntry = step.payments.find(p => p.loanId === loan.id);
            const balance = paymentEntry ? Math.max(0, paymentEntry.balance) : 0;
            const totalPmt = paymentEntry?.payment ?? 0;
            const minPmt = paymentEntry?.minPayment ?? totalPmt;
            const extraPmt = paymentEntry?.extraPayment ?? 0;

            loanDataMap[loan.id].push({
                month: monthNum,
                balance,
                payment: totalPmt,
                minPayment: minPmt,
                extraPayment: extraPmt,
            });

            if (
                balance <= 0.01 &&
                !loanPayoffMonth[loan.id] &&
                (loanDataMap[loan.id][loanDataMap[loan.id].length - 2]?.balance ?? 0) > 0.01
            ) {
                loanPayoffMonth[loan.id] = monthNum;
            }
        }
    });

    const loanCharts = loans.map((loan, i) => {
        const rawData = loanDataMap[loan.id] ?? [];
        const payoffIdx = rawData.findIndex(d => d.balance <= 0.01);
        const trimmed = payoffIdx > 0 ? rawData.slice(0, payoffIdx + 2) : rawData;
        return { loan, data: trimmed, color: CHART_COLORS[i % CHART_COLORS.length], payoffMonth: loanPayoffMonth[loan.id] ?? 0 };
    });

    loanCharts.sort((a, b) => {
        if (a.payoffMonth === 0 && b.payoffMonth === 0) return 0;
        if (a.payoffMonth === 0) return 1;
        if (b.payoffMonth === 0) return -1;
        return a.payoffMonth - b.payoffMonth;
    });

    const cols = loans.length === 1 ? 'grid-cols-1' : loans.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

    return (
        <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <h2 className="text-xl font-semibold mb-1">Per-Loan Payoff Schedule</h2>
            <p className="text-sm text-dark-text-secondary mb-5">Balance over time for each loan, including minimum and extra payments.</p>
            <div className={`grid ${cols} gap-5`}>
                {loanCharts.map(({ loan, data, color, payoffMonth }) => (
                    <SingleLoanChart key={loan.id} loan={loan} data={data} color={color} payoffMonth={payoffMonth} startDate={effectiveStartDate} />
                ))}
            </div>
        </div>
    );
};

export default LoanTrellisChart;
