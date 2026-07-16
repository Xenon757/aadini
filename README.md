# PayoffPal - Personal Finance & Debt Payoff Planner

A web application to help you manage your finances and create a debt payoff plan using the avalanche method.

## Features

- **Income Management**: Track net or gross income with automatic tax calculations
- **Expense Tracking**: Manage monthly expenses with standard categories
- **Loan Management**: Add and track multiple loans (Credit Card, Mortgage, Auto, Student, Other)
- **Loan Affordability Check**: See if you can afford a new loan based on DTI ratio
- **Debt Payoff Plan**: Visualize your path to being debt-free with charts
- **Risk Profile Settings**: Customize DTI thresholds based on your risk tolerance

## NEW: Other Deductions Field

The Finances page now includes an **"Other Deductions"** field when using Gross Income mode. Use this to enter monthly deductions like:
- Health insurance premiums
- HSA/FSA contributions
- Union dues
- Other pre-tax deductions

This amount is automatically factored into your net income calculation.

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

3. Open your browser to the URL shown (usually http://localhost:5173)

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Technology Stack

- React 19
- TypeScript
- Vite
- Recharts for data visualization
- React Router for navigation
- Local Storage for persistence

## How It Works

### Avalanche Method

PayoffPal uses the avalanche method for debt payoff:
1. Pay minimums on all loans
2. Apply extra payment to the highest APR loan
3. When a loan is paid off, roll that payment to the next highest APR loan
4. Saves you the most money on interest

### Tax Calculations

When using Gross Income mode, PayoffPal calculates your net income by considering:
- Federal income tax brackets
- State income tax (for applicable states)
- Local/city taxes (for applicable cities)
- FICA taxes (Social Security & Medicare)
- 401(k) contributions (pre-tax)
- Other deductions (pre-tax)

### DTI (Debt-to-Income) Ratio

Your DTI ratio is the percentage of your gross monthly income that goes toward debt payments. Lenders use this to assess loan affordability:
- Conservative (Low Risk): Keep DTI below 30%
- Moderate (Average Risk): Keep DTI below 36%
- Aggressive (High Risk): Keep DTI below 40%

## License

MIT
