import {CreateAppDevelopmentStore} from '../../../api/graphql/business-platform-organizations/generated/create_app_development_store.js'
import {
  PollStoreCreation,
  PollStoreCreationQuery,
} from '../../../api/graphql/business-platform-organizations/generated/poll_store_creation.js'
import {selectOrg} from '@shopify/organizations'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputContent, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'

const POLL_INTERVAL_SECONDS = 2
const POLL_TIMEOUT_MS = 5 * 60 * 1000

interface CreateDevStoreOptions {
  name: string
  organization?: string
  json: boolean
}

type StoreCreationStatus = NonNullable<
  NonNullable<NonNullable<PollStoreCreationQuery['organization']>['storeCreation']>['status']
>

function friendlyStatus(status: StoreCreationStatus): string {
  switch (status) {
    case 'CALLING_CORE':
      return 'Initiating store creation...'
    case 'AWAITING_CORE_STORE_READY':
      return 'Waiting for store to be ready...'
    case 'FINALIZING':
      return 'Finalizing store setup...'
    case 'COMPLETE':
      return 'Store creation complete!'
    case 'FAILED':
      return 'Store creation failed.'
    case 'TIMED_OUT':
      return 'Store creation timed out.'
    case 'USER_ERROR':
      return 'Store creation encountered a user error.'
    default:
      return `Store creation status: ${status}`
  }
}

export async function createDevStore(options: CreateDevStoreOptions): Promise<void> {
  const org = await selectOrg(options.organization)
  const token = await ensureAuthenticatedBusinessPlatform()
  const unauthorizedHandler = {
    type: 'token_refresh' as const,
    handler: async () => {
      const newToken = await ensureAuthenticatedBusinessPlatform()
      return {token: newToken}
    },
  }

  const mutationResult = await businessPlatformOrganizationsRequestDoc({
    query: CreateAppDevelopmentStore,
    token,
    organizationId: org.id,
    variables: {
      shopName: options.name,
      priceLookupKey: 'SHOPIFY_PLUS_APP_DEVELOPMENT',
      prepopulateTestData: false,
    },
    unauthorizedHandler,
  })

  const createAppDevelopmentStore = mutationResult.createAppDevelopmentStore
  if (!createAppDevelopmentStore) {
    throw new AbortError('Store creation failed: unexpected empty response.')
  }
  const userErrors = createAppDevelopmentStore.userErrors
  if (userErrors && userErrors.length > 0) {
    const messages = userErrors.map((e) => e.message).join(', ')
    throw new AbortError(`Failed to create development store: ${messages}`)
  }

  const {shopDomain, shopAdminUrl} = createAppDevelopmentStore
  if (!shopDomain) {
    throw new AbortError('Store creation succeeded but no shop domain was returned.')
  }

  await renderSingleTask({
    title: outputContent`Waiting for store to be ready...`,
    task: async (updateStatus) => {
      const startTime = Date.now()
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          throw new AbortError('Store creation timed out after 5 minutes.')
        }

        const pollResult = await businessPlatformOrganizationsRequestDoc({
          query: PollStoreCreation,
          token,
          organizationId: org.id,
          variables: {shopDomain},
          unauthorizedHandler,
        })

        const status = pollResult.organization?.storeCreation?.status
        if (!status) {
          throw new AbortError('Unable to determine store creation status.')
        }

        if (status === 'COMPLETE') {
          return
        }
        if (status === 'FAILED' || status === 'TIMED_OUT' || status === 'USER_ERROR') {
          throw new AbortError(`Store creation failed with status: ${status}`)
        }

        updateStatus(outputContent`${friendlyStatus(status)}`)

        await sleep(POLL_INTERVAL_SECONDS)
      }
    },
    renderOptions: {stdout: process.stderr},
  })

  if (options.json) {
    outputResult(
      JSON.stringify(
        {
          store: {
            name: options.name,
            domain: shopDomain,
            adminUrl: shopAdminUrl,
          },
          organization: {
            id: org.id,
            name: org.businessName,
          },
        },
        null,
        2,
      ),
    )
  } else {
    renderSuccess({
      headline: `Development store "${options.name}" created successfully.`,
      body: [`Domain: ${shopDomain}`, `Admin: ${shopAdminUrl ?? 'N/A'}`],
    })
  }
}
