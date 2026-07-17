import { defineBackend } from '@aws-amplify/backend';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { plaidFunction } from './functions/plaid/resource';

const backend = defineBackend({
  auth,
  data,
  plaidFunction,
});

/**
 * Plaid access tokens live in a raw DynamoDB table (not an Amplify Data
 * model) so there is NO AppSync/API path to them from the browser — only
 * the plaid-api Lambda holds IAM permissions on this table.
 */
const plaidTokenStack = backend.createStack('plaid-token-storage');
const plaidTokenTable = new Table(plaidTokenStack, 'PlaidTokenTable', {
  partitionKey: { name: 'itemId', type: AttributeType.STRING },
  billingMode: BillingMode.PAY_PER_REQUEST,
  // Tokens are recoverable by reconnecting the bank; safe to drop with the stack.
  removalPolicy: RemovalPolicy.DESTROY,
});
plaidTokenTable.addGlobalSecondaryIndex({
  indexName: 'byUserSub',
  partitionKey: { name: 'userSub', type: AttributeType.STRING },
});
plaidTokenTable.grantReadWriteData(backend.plaidFunction.resources.lambda);
backend.plaidFunction.addEnvironment('PLAID_TOKEN_TABLE', plaidTokenTable.tableName);
