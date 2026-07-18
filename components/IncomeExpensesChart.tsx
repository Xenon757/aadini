import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { MonthlyFinanceSnapshot } from '../types';

const INCOME_COLOR = '#68a063';   // green — income (above the axis)
const EXPENSE_COLOR = '#e29aa0';  // muted red — expenses (below the axis)

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(value);

/** 'YYYY-MM' -> 'MM/YY' */
const toMonthYear = (month: string): string => {
    const [year, mon] = month.split('-');
    return `${mon}/${year.slice(2)}`;
};

interface ChartRow {
    label: string;
    income: number;
    expenses: number; // stored negative so the bar renders below the axis
    rawExpenses: number;
}

interface IncomeExpensesChartProps {
    history: MonthlyFinanceSnapshot[];
}

const IncomeExpensesChart: React.FC<IncomeExpensesChartProps> = ({ history }) => {
    const data = useMemo<ChartRow[]>(
        () =>
            [...history]
                .sort((a, b) => a.month.localeCompare(b.month))
                .slice(-12)
                .map(h => ({
                    label: toMonthYear(h.month),
                    income: h.income,
                    expenses: -h.expenses,
                    rawExpenses: h.expenses,
                })),
        [history]
    );

    return (
        <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 gap-2">
                <h2 className="text-xl font-semibold">Income &amp; Expenses Breakdown</h2>
                <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-2 text-dark-text-secondary">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: INCOME_COLOR }} />
                        Income
                    </span>
                    <span className="flex items-center gap-2 text-dark-text-secondary">
                        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: EXPENSE_COLOR }} />
                        Expenses
                    </span>
                </div>
            </div>
            <p className="text-sm text-dark-text-secondary mb-4">
                Monthly net income vs. expenses over the past 12 months.
            </p>

            {data.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-dark-text-secondary text-sm">
                    Add your income and expenses to start building your 12-month history.
                </div>
            ) : (
                <div style={{ width: '100%', height: 340 }}>
                    <ResponsiveContainer>
                        <BarChart
                            data={data}
                            margin={{ top: 10, right: 16, left: 8, bottom: 8 }}
                            barCategoryGap="35%"
                            stackOffset="sign"
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#4a5568" vertical={false} />
                            <XAxis
                                dataKey="label"
                                stroke="#a0aec0"
                                tick={{ fontSize: 12 }}
                                tickLine={false}
                                interval={0}
                            />
                            <YAxis
                                stroke="#a0aec0"
                                tick={{ fontSize: 12 }}
                                width={70}
                                tickFormatter={(v: number) => formatCurrency(Math.abs(v))}
                            />
                            <ReferenceLine y={0} stroke="#a0aec0" strokeWidth={1.5} />
                            <Tooltip
                                cursor={{ fill: 'rgba(160, 174, 192, 0.1)' }}
                                contentStyle={{ backgroundColor: '#2d3748', border: '1px solid #4a5568', borderRadius: '8px', fontSize: 12 }}
                                labelStyle={{ color: '#e2e8f0' }}
                                formatter={(value: number, name: string, item: { payload?: ChartRow }) => {
                                    if (name === 'expenses') {
                                        return [formatCurrency(item.payload?.rawExpenses ?? Math.abs(value)), 'Expenses'];
                                    }
                                    return [formatCurrency(value), 'Income'];
                                }}
                            />
                            <Bar dataKey="income" stackId="stack" fill={INCOME_COLOR} radius={[6, 6, 0, 0]} maxBarSize={48} />
                            <Bar dataKey="expenses" stackId="stack" fill={EXPENSE_COLOR} radius={[0, 0, 6, 6]} maxBarSize={48} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

export default IncomeExpensesChart;
