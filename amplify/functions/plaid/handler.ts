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
import { mapLiabilitiesToLoans, mapRecurringToExpenses, MappedLoan, MappedExpense } from './mapping';

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
};

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

async function createLinkToken(sub: string) {
  const response = await plaid.linkTokenCreate({
    user: { client_user_id: sub },
    client_name: 'PayoffPal',
    products: [Products.Liabilities, Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
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
    return { loans: [], expenses: [], syncedItemIds: [], lastSyncedAt: now };
  }

  const allLoans: MappedLoan[] = [];
  const allExpenses: MappedExpense[] = [];
  const syncedItemIds: string[] = [];

  for (const token of tokens) {
    const { data: items } = await dataClient.models.PlaidItem.list({
      filter: { itemId: { eq: token.itemId } },
    });
    const institutionName = items[0]?.institutionName ?? undefined;

    const liabilities = await plaid.liabilitiesGet({ access_token: token.accessToken });
    allLoans.push(...mapLiabilitiesToLoans(liabilities.data, token.itemId, institutionName));

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

    if (items[0]) {
      await dataClient.models.PlaidItem.update({ id: items[0].id, lastSyncedAt: now });
    }
    syncedItemIds.push(token.itemId);
  }

  // Return raw arrays: AWSJSON fields are serialized by AppSync itself;
  // pre-stringifying here double-encodes and the client sees a string.
  return {
    loans: allLoans,
    expenses: allExpenses,
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
        return await createLinkToken(sub);
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
