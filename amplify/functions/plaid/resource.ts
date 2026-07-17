import { defineFunction, secret } from '@aws-amplify/backend';

export const plaidFunction = defineFunction({
  name: 'plaid-api',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    PLAID_CLIENT_ID: secret('PLAID_CLIENT_ID'),
    PLAID_SECRET: secret('PLAID_SECRET'),
    PLAID_ENV: 'sandbox',
  },
});
