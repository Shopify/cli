import {CreateAppDevelopmentStore} from '../../api/graphql/business-platform-organizations/generated/create_app_development_store.js'
import {
  PollStoreCreation,
  PollStoreCreationQuery,
} from '../../api/graphql/business-platform-organizations/generated/poll_store_creation.js'
import {Organization} from '../../models/organization.js'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputResult} from '@shopify/cli-kit/node/output'
import {sleep} from '@shopify/cli-kit/node/system'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess, type InlineToken} from '@shopify/cli-kit/node/ui'

interface BusinessPlatformTokenRefreshHandlerOptions {
  noPrompt?: boolean
}

export function businessPlatformTokenRefreshHandler(
  options: BusinessPlatformTokenRefreshHandlerOptions = {},
): UnauthorizedHandler {
  return {
    type: 'token_refresh',
    handler: async () => ({token: await ensureAuthenticatedBusinessPlatform([], {noPrompt: options.noPrompt})}),
  }
}

/** User-facing plan handles mapped to Business Platform price lookup keys. */
export const DEV_STORE_PLANS = {
  basic: 'BASIC_APP_DEVELOPMENT',
  grow: 'PROFESSIONAL_APP_DEVELOPMENT',
  advanced: 'UNLIMITED_APP_DEVELOPMENT',
  plus: 'SHOPIFY_PLUS_APP_DEVELOPMENT',
} as const
export type DevStorePlan = keyof typeof DEV_STORE_PLANS
export const devStorePlanHandles = Object.keys(DEV_STORE_PLANS) as DevStorePlan[]

const POLL_INTERVAL_SECONDS = 2
const POLL_TIMEOUT_MS = 5 * 60 * 1000

export interface CreateDevStoreOptions {
  name: string
  plan: DevStorePlan
  organization: Organization
  featurePreview?: string
  withDemoData?: boolean
  country?: string
  json?: boolean
  summary?: boolean
}

type StoreCreationStatus = NonNullable<
  NonNullable<NonNullable<PollStoreCreationQuery['organization']>['storeCreation']>['status']
>

function friendlyStatus(status: StoreCreationStatus): string {
  switch (status) {
    case 'CALLING_CORE':
      return 'Initiating store creation'
    case 'AWAITING_CORE_STORE_READY':
      return 'Waiting for store to be ready'
    case 'FINALIZING':
      return 'Finalizing store setup'
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

export async function createDevStore(options: CreateDevStoreOptions): Promise<string> {
  const {organization: org, name, plan} = options
  const token = await ensureAuthenticatedBusinessPlatform()
  const unauthorizedHandler = businessPlatformTokenRefreshHandler()

  const mutationResult = await businessPlatformOrganizationsRequestDoc({
    query: CreateAppDevelopmentStore,
    token,
    organizationId: org.id,
    variables: {
      shopName: name,
      priceLookupKey: DEV_STORE_PLANS[plan],
      prepopulateTestData: options.withDemoData ?? false,
      developerPreviewHandle: options.featurePreview,
      country: options.country,
    },
    unauthorizedHandler,
  })

  const createAppDevelopmentStore = mutationResult.createAppDevelopmentStore
  if (!createAppDevelopmentStore) {
    throw new AbortError('Store creation failed: unexpected empty response.')
  }
  const userErrors = createAppDevelopmentStore.userErrors
  if (userErrors && userErrors.length > 0) {
    const messages = userErrors.map((error) => error.message).join(', ')
    throw new AbortError(`Failed to create development store: ${messages}`)
  }

  const {shopDomain, shopAdminUrl} = createAppDevelopmentStore
  if (!shopDomain) {
    throw new AbortError('Store creation succeeded but no shop domain was returned.')
  }

  await renderSingleTask({
    title: outputContent`Waiting for store to be ready`,
    task: async (updateStatus) => {
      const startTime = Date.now()
      while (true) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          throw new AbortError('Store creation timed out after 5 minutes.')
        }

        // eslint-disable-next-line no-await-in-loop
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

        // eslint-disable-next-line no-await-in-loop
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
            name,
            domain: shopDomain,
            adminUrl: shopAdminUrl,
            plan,
            ...(options.featurePreview ? {featurePreview: options.featurePreview} : {}),
            ...(options.country ? {country: options.country} : {}),
            demoData: options.withDemoData ?? false,
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
  } else if (options.summary !== false) {
    const rows: InlineToken[][] = []
    pushRow(rows, 'Domain', shopDomain)
    // Admin always renders, falling back to 'N/A' when the URL is missing, so the
    // summary never silently drops this commonly expected field.
    rows.push(['Admin', shopAdminUrl ? {link: {label: shopAdminUrl, url: shopAdminUrl}} : 'N/A'])
    pushRow(rows, 'Plan', plan)
    pushRow(rows, 'Feature preview', options.featurePreview)
    pushRow(rows, 'Country', options.country)
    pushRow(rows, 'Demo data', options.withDemoData ? 'enabled' : 'disabled')

    renderSuccess({
      headline: `Development store "${name}" created successfully.`,
      customSections: [{body: {tabularData: rows, firstColumnSubdued: true}}],
    })
  }

  return shopDomain
}

function pushRow(rows: InlineToken[][], label: string, value: InlineToken | undefined): void {
  if (value !== undefined && value !== null && value !== '') {
    rows.push([label, value])
  }
}
