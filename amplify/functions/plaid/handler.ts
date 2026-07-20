import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid';
import { env } from '$amplify/env/plaid-api';
import type { Schema } from '../../data/resource';
import {
  mapLiabilitiesToLoans,
  mapRecurringToExpenses,
  mapTransactionsToMonthlyHistory,
  MappedLoan,
  MappedExpense,
  MappedMonthlySnapshot,
} from './mapping';
import type { Transaction } from 'plaid';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);
const dataClient = generateClient<Schema>();

const TOKEN_TABLE = process.env.PLAID_TOKEN_TABLE!;
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const plaid = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[env.PLAID_ENV] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': env.PLAID_CLIENT_ID,
        'PLAID-SECRET': env.PLAID_SECRET,
      },
    },
  })
);

type PlaidArgs = {
  publicToken?: string;
  institutionId?: string;
  institutionName?: string;
  itemId?: string;
  redirectUri?: string;
};

/**
 * OAuth-institution return URLs Link is allowed to redirect to. Must
 * mirror the "Allowed redirect URIs" registered in the Plaid dashboard.
 */
const ALLOWED_REDIRECT_URIS = new Set([
  'http://localhost:3000/finances',
  'https://main.d1ds52t71fj84r.amplifyapp.com/finances',
]);

/**
 * Amplify Gen 2's generated resolver invokes the function with fieldName/
 * typeName at the TOP level of the payload (not nested under `info` like a
 * raw AppSync direct-Lambda event). Accept both shapes defensively.
 */
interface PlaidEvent {
  fieldName?: string;
  typeName?: string;
  info?: { fieldName?: string };
  arguments: PlaidArgs;
  identity?: { sub?: string } | null;
}

interface TokenRecord {
  itemId: string;
  accessToken: string;
  userSub: string;
}

const callerSub = (event: PlaidEvent): string => {
  const sub = event.identity?.sub;
  if (!sub) {
    throw new Error('Unauthorized: no Cognito identity on request');
  }
  return sub;
};

/** All Plaid token rows for this user (server-side scoping by userSub). */
async function tokensForUser(sub: string): Promise<TokenRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TOKEN_TABLE,
      IndexName: 'byUserSub',
      KeyConditionExpression: 'userSub = :sub',
      ExpressionAttributeValues: { ':sub': sub },
    })
  );
  return (result.Items ?? []) as TokenRecord[];
}

async function createLinkToken(sub: string, args: PlaidArgs) {
  const redirectUri =
    args.redirectUri && ALLOWED_REDIRECT_URIS.has(args.redirectUri)
      ? args.redirectUri
      : undefined;
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: sub },
    client_name: 'PayoffPal',
    // Transactions is the only hard requirement; Liabilities activates
    // when the user's accounts support it. Requiring Liabilities outright
    // blocks users whose bank login has no loan accounts (e.g. checking
    // only) from connecting at all.
    products: [Products.Transactions],
    required_if_supported_products: [Products.Liabilities],
    country_codes: [CountryCode.Us],
    language: 'en',
    ...(redirectUri ? { redirect_uri: redirectUri } : {}),
  });
  return {
    linkToken: response.data.link_token,
    expiration: response.data.expiration,
  };
}

async function exchangePublicToken(sub: string, args: PlaidArgs) {
  if (!args.publicToken) throw new Error('publicToken is required');
  const exchange = await plaid.itemPublicTokenExchange({ public_token: args.publicToken });
  const itemId = exchange.data.item_id;
  const accessToken = exchange.data.access_token;

  await ddb.send(
    new PutCommand({
      TableName: TOKEN_TABLE,
      Item: { itemId, accessToken, userSub: sub } satisfies TokenRecord,
    })
  );

  const { errors: itemErrors } = await dataClient.models.PlaidItem.create({
    itemId,
    institutionId: args.institutionId,
    institutionName: args.institutionName,
    connectedAt: new Date().toISOString(),
    status: 'active',
    owner: sub,
  });
  if (itemErrors?.length) {
    throw new Error(`Failed to store item metadata: ${itemErrors[0].message}`);
  }

  return { itemId, institutionName: args.institutionName ?? null };
}

const YYYY_MM_DD = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * Pulls every settled transaction in [startDate, endDate], paging through
 * Plaid's offset-based transactionsGet (max 500 per page).
 */
async function fetchTransactions(
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const all: Transaction[] = [];
  const count = 500;
  let offset = 0;
  // Hard cap on pages to avoid pathological loops (500 * 40 = 20k txns).
  for (let page = 0; page < 40; page++) {
    const resp = await plaid.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count, offset },
    });
    all.push(...resp.data.transactions);
    if (all.length >= resp.data.total_transactions) break;
    offset = all.length;
  }
  return all;
}

async function syncPlaidData(sub: string, args: PlaidArgs) {
  let tokens = await tokensForUser(sub);
  if (args.itemId) {
    tokens = tokens.filter((t) => t.itemId === args.itemId);
    if (tokens.length === 0) {
      throw new Error('Unknown itemId for this user');
    }
  }
  const now = new Date().toISOString();
  if (tokens.length === 0) {
    return { loans: [], expenses: [], incomeExpenseHistory: [], syncedItemIds: [], lastSyncedAt: now };
  }

  const allLoans: MappedLoan[] = [];
  const allExpenses: MappedExpense[] = [];
  const allTransactions: Transaction[] = [];
  const syncedItemIds: string[] = [];

  // 12-month window: first day of the month 11 months back through today.
  const endDateObj = new Date();
  const startDateObj = new Date(
    Date.UTC(endDateObj.getUTCFullYear(), endDateObj.getUTCMonth() - 11, 1)
  );
  const startDate = YYYY_MM_DD(startDateObj);
  const endDate = YYYY_MM_DD(endDateObj);

  for (const token of tokens) {
    const { data: items } = await dataClient.models.PlaidItem.list({
      filter: { itemId: { eq: token.itemId } },
    });
    const institutionName = items[0]?.institutionName ?? undefined;

    try {
      const liabilities = await plaid.liabilitiesGet({ access_token: token.accessToken });
      allLoans.push(...mapLiabilitiesToLoans(liabilities.data, token.itemId, institutionName));
    } catch (err: unknown) {
      // An item with no loan accounts (checking/savings-only logins) is a
      // normal case, not a failure — transactions still sync below.
      const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (!['NO_LIABILITY_ACCOUNTS', 'PRODUCTS_NOT_SUPPORTED', 'PRODUCT_NOT_READY'].includes(code ?? '')) {
        throw err;
      }
    }

    try {
      const recurring = await plaid.transactionsRecurringGet({ access_token: token.accessToken });
      allExpenses.push(
        ...mapRecurringToExpenses(recurring.data.outflow_streams, token.itemId, institutionName)
      );
    } catch (err: unknown) {
      // PRODUCT_NOT_READY: initial transaction pull still running right after
      // connect. Return loans now; the UI's Refresh button retries expenses.
      const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code !== 'PRODUCT_NOT_READY') throw err;
    }

    try {
      allTransactions.push(...(await fetchTransactions(token.accessToken, startDate, endDate)));
    } catch (err: unknown) {
      // Same not-ready race as recurring: skip history this pass, retry later.
      const code = (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code !== 'PRODUCT_NOT_READY') throw err;
    }

    if (items[0]) {
      await dataClient.models.PlaidItem.update({ id: items[0].id, lastSyncedAt: now });
    }
    syncedItemIds.push(token.itemId);
  }

  // Aggregate all connected accounts into a single household 12-month history.
  // Empty when transactions weren't ready — the client keeps its prior history.
  const incomeExpenseHistory: MappedMonthlySnapshot[] = allTransactions.length
    ? mapTransactionsToMonthlyHistory(allTransactions, endDateObj)
    : [];

  // Return raw arrays: AWSJSON fields are serialized by AppSync itself;
  // pre-stringifying here double-encodes and the client sees a string.
  return {
    loans: allLoans,
    expenses: allExpenses,
    incomeExpenseHistory,
    syncedItemIds,
    lastSyncedAt: now,
  };
}

async function disconnectItem(sub: string, args: PlaidArgs) {
  if (!args.itemId) throw new Error('itemId is required');
  const tokens = await tokensForUser(sub);
  const token = tokens.find((t) => t.itemId === args.itemId);
  if (!token) throw new Error('Unknown itemId for this user');

  await plaid.itemRemove({ access_token: token.accessToken });
  await ddb.send(
    new DeleteCommand({ TableName: TOKEN_TABLE, Key: { itemId: token.itemId } })
  );

  const { data: items } = await dataClient.models.PlaidItem.list({
    filter: { itemId: { eq: token.itemId } },
  });
  if (items[0]) {
    await dataClient.models.PlaidItem.delete({ id: items[0].id });
  }

  return { itemId: token.itemId, removed: true };
}

/** Surfaces Plaid's real error code/message instead of a bare axios 4xx. */
const rethrowPlaidError = (err: unknown): never => {
  const data = (err as { response?: { data?: { error_code?: string; error_message?: string } } })
    ?.response?.data;
  if (data?.error_code) {
    throw new Error(`Plaid ${data.error_code}: ${data.error_message ?? 'no details'}`);
  }
  throw err;
};

export const handler = async (event: PlaidEvent) => {
  const sub = callerSub(event);
  const fieldName = event.fieldName ?? event.info?.fieldName;
  try {
    switch (fieldName) {
      case 'createPlaidLinkToken':
        return await createLinkToken(sub, event.arguments);
      case 'exchangePlaidPublicToken':
        return await exchangePublicToken(sub, event.arguments);
      case 'syncPlaidData':
        return await syncPlaidData(sub, event.arguments);
      case 'disconnectPlaidItem':
        return await disconnectItem(sub, event.arguments);
      default:
        throw new Error(`Unknown operation: ${fieldName}`);
    }
  } catch (err) {
    console.error(`${fieldName} failed:`, err);
    rethrowPlaidError(err);
  }
};
