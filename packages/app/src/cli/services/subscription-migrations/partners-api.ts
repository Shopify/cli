import {
  type MigratableSubscription,
  type MigratableSubscriptionStatus,
  type MigrationOperation,
  type NotificationKind,
  type PriceBehavior,
} from '../../models/subscription-migrations.js'
import {
  AppSubscriptionMigrationOperationCancelMutation,
  AppSubscriptionMigrationOperationCreateMutation,
  AppSubscriptionMigrationOperationQuery,
  MigratableAppSubscriptionsQuery,
} from '../../api/graphql/subscription_migrations.js'
import {PartnersClient} from '../../utilities/developer-platform-client/partners-client.js'

export interface MigrationApiInput {
  shopId: string
  action:
    | {
        scheduleMigration: {
          targetPlanHandle: string
          priceBehavior: PriceBehavior
          notification: NotificationKind
        }
      }
    | {cancelMigration: true}
}

export interface MigrationUserError {
  message: string
  field: string[] | null
}

export interface MigrationOperationPayload {
  operation: MigrationOperation | null
  userErrors: MigrationUserError[]
}

type MigrationResultEdge = MigrationOperation['results']['edges'][number]

interface RawMigrationResultConnection {
  edges: (MigrationResultEdge | null)[] | null
}

type RawMigrationOperation = Omit<MigrationOperation, 'results'> & {
  results: RawMigrationResultConnection | null
}

interface RawMigrationOperationPayload {
  operation: RawMigrationOperation | null
  userErrors: MigrationUserError[] | null
}

interface RawMigratableSubscriptionConnection {
  edges: ({cursor: string; node: MigratableSubscription} | null)[] | null
  pageInfo: MigratableSubscriptionPageInfo
}

interface MigratableAppSubscriptionsResponse {
  migratableAppSubscriptions: RawMigratableSubscriptionConnection | null
}

interface CreateMigrationOperationResponse {
  appSubscriptionMigrationOperationCreate: RawMigrationOperationPayload
}

interface GetMigrationOperationResponse {
  appSubscriptionMigrationOperation: RawMigrationOperation | null
}

interface CancelMigrationOperationResponse {
  appSubscriptionMigrationOperationCancel: RawMigrationOperationPayload
}

export interface MigratableSubscriptionPageInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface MigratableSubscriptionPage {
  subscriptions: MigratableSubscription[]
  pageInfo: MigratableSubscriptionPageInfo
}

interface GetMigratableSubscriptionPageOptions {
  clientId: string
  first: number
  after?: string
  status?: MigratableSubscriptionStatus
}

interface CreateMigrationOperationOptions {
  clientId: string
  idempotencyKey: string
  migrations: MigrationApiInput[]
}

interface MigrationOperationOptions {
  clientId: string
  operationId: string
}

function normalizeMigrationOperation(operation: RawMigrationOperation | null): MigrationOperation | null {
  if (operation === null) return null

  return {
    ...operation,
    results: {
      edges: operation.results?.edges?.filter((edge): edge is MigrationResultEdge => edge !== null) ?? [],
    },
  }
}

function normalizeMigrationOperationPayload(payload: RawMigrationOperationPayload): MigrationOperationPayload {
  return {
    operation: normalizeMigrationOperation(payload.operation),
    userErrors: payload.userErrors ?? [],
  }
}

export async function getMigratableSubscriptionPage({
  clientId,
  first,
  after,
  status,
}: GetMigratableSubscriptionPageOptions): Promise<MigratableSubscriptionPage | null> {
  const response = await PartnersClient.getInstance().request<MigratableAppSubscriptionsResponse>(
    MigratableAppSubscriptionsQuery,
    {apiKey: clientId, first, after, status},
  )
  const connection = response.migratableAppSubscriptions
  if (connection === null) return null

  return {
    subscriptions: connection.edges?.flatMap((edge) => (edge === null ? [] : [edge.node])) ?? [],
    pageInfo: connection.pageInfo,
  }
}

export async function createMigrationOperation({
  clientId,
  idempotencyKey,
  migrations,
}: CreateMigrationOperationOptions): Promise<MigrationOperationPayload> {
  const response = await PartnersClient.getInstance().request<CreateMigrationOperationResponse>(
    AppSubscriptionMigrationOperationCreateMutation,
    {input: {apiKey: clientId, idempotencyKey, migrations}},
  )

  return normalizeMigrationOperationPayload(response.appSubscriptionMigrationOperationCreate)
}

export async function getMigrationOperation({
  clientId,
  operationId,
}: MigrationOperationOptions): Promise<MigrationOperation | null> {
  const response = await PartnersClient.getInstance().request<GetMigrationOperationResponse>(
    AppSubscriptionMigrationOperationQuery,
    {
      apiKey: clientId,
      id: operationId,
    },
  )

  return normalizeMigrationOperation(response.appSubscriptionMigrationOperation)
}

export async function cancelMigrationOperation({
  clientId,
  operationId,
}: MigrationOperationOptions): Promise<MigrationOperationPayload> {
  const response = await PartnersClient.getInstance().request<CancelMigrationOperationResponse>(
    AppSubscriptionMigrationOperationCancelMutation,
    {input: {apiKey: clientId, id: operationId}},
  )

  return normalizeMigrationOperationPayload(response.appSubscriptionMigrationOperationCancel)
}
