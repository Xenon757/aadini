import { defineFunction, secret } from '@aws-amplify/backend';

export const plaidFunction = defineFunction({
  name: 'plaid-api',
  entry: './handler.ts',
  timeoutSeconds: 30,
  environment: {
    PLAID_CLIENT_ID: secret('PLAID_CLIENT_ID'),
    PLAID_SECRET: secret('PLAID_SECRET'),
    // Resolved at deploy time: local `ampx sandbox` defaults to Plaid's
    // sandbox; the hosted branch flips to production by setting the
    // PLAID_ENV env var in the Amplify console build environment
    // (alongside the matching production PLAID_SECRET secret).
    PLAID_ENV: process.env.PLAID_ENV ?? 'sandbox',
  },
});
