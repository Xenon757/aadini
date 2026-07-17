import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Email/password + Google sign-in, matching the app's two sign-in methods.
 * Google requires a Cloud OAuth client (console-only setup, see project README);
 * its ID/secret are supplied as Amplify secrets, not committed to source.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        scopes: ['email', 'profile'],
      },
      callbackUrls: [
        'http://localhost:3000/',
      ],
      logoutUrls: [
        'http://localhost:3000/',
      ],
    },
  },
});
