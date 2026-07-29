import {businessPlatformTokenRefreshHandler} from '../business-platform.js'
import {fetchOptionalOrganizationShop} from '../../../utilities/store-lookup/organization-shop.js'
import {DeleteAppDevelopmentStore} from '../../../api/graphql/business-platform-organizations/generated/delete_app_development_store.js'
import {
  OrganizationAccessibleShop,
  type OrganizationAccessibleShopQuery,
  type OrganizationAccessibleShopQueryVariables,
} from '../../../api/graphql/business-platform-organizations/generated/organization_accessible_shop.js'
import {type Organization} from '@shopify/organizations'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {type UnauthorizedHandler} from '@shopify/cli-kit/node/api/graphql'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSingleTask, renderSuccess, renderWarning} from '@shopify/cli-kit/node/ui'
import {outputContent, outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'
import {sleep} from '@shopify/cli-kit/node/system'

const CANCELLED_PLAN_NAME = 'cancelled'
const POLL_INTERVAL_SECONDS = 5
const POLL_TIMEOUT_MS = 5 * 60 * 1000

interface DeleteDevStoreOptions {
  store: string
  organization: Organization
  json: boolean
}

interface StoreDeletionConfirmationOptions {
  shopifyShopId: string
  organizationId: string
  token: string
  unauthorizedHandler: UnauthorizedHandler
}

export async function deleteDevStore(options: DeleteDevStoreOptions): Promise<void> {
  const {organization: org, store} = options
  const token = await ensureAuthenticatedBusinessPlatform()
  const unauthorizedHandler = businessPlatformTokenRefreshHandler()
  let shopifyShopId = await fetchShopifyShopId({store, organizationId: org.id, token})

  const mutationResult = await businessPlatformOrganizationsRequestDoc({
    query: DeleteAppDevelopmentStore,
    token,
    organizationId: org.id,
    variables: {storeFqdn: store},
    unauthorizedHandler,
  })

  const deleteAppDevelopmentStore = mutationResult.deleteAppDevelopmentStore
  if (!deleteAppDevelopmentStore) {
    throw new AbortError('Store deletion failed: unexpected empty response.')
  }

  const userErrors = deleteAppDevelopmentStore.userErrors
  if (userErrors && userErrors.length > 0) {
    const messages = userErrors.map((error) => error.message).join(', ')
    throw new AbortError(`Failed to delete development store: ${messages}`)
  }
  if (deleteAppDevelopmentStore.success === false) {
    throw new AbortError('Store deletion failed.')
  }

  shopifyShopId ??= await fetchShopifyShopId({store, organizationId: org.id, token})

  const deletionConfirmed = shopifyShopId
    ? await waitForStoreDeletionConfirmation({
        shopifyShopId,
        organizationId: org.id,
        token,
        unauthorizedHandler,
      })
    : false

  if (options.json) {
    outputResult(deletionResultJson({store, organization: org, deletionConfirmed}))
  } else if (deletionConfirmed) {
    renderSuccess({
      headline: `Development store "${store}" deleted successfully.`,
      body: ['The store was deleted.'],
    })
  } else {
    renderWarning({
      headline: `Development store "${store}" deletion was requested, but not confirmed.`,
      body: [
        'Shopify accepted the deletion request, but deletion was not confirmed before the CLI stopped waiting.',
        'The store may still finish deleting asynchronously.',
      ],
    })
  }
}

async function fetchShopifyShopId(options: {
  store: string
  organizationId: string
  token: string
}): Promise<string | undefined> {
  const shop = await fetchOptionalOrganizationShop(options)
  return shop?.shopifyShopId
}

export function toOrganizationsShopifyShopId(shopifyShopId: string | number): string {
  const raw = String(shopifyShopId)
  const numericId = raw.match(/^(?:gid:\/\/shopify\/Shop\/)?(\d+)$/)?.[1]

  if (!numericId) {
    throw new Error(`Invalid Shopify shop ID: ${raw}`)
  }

  return Buffer.from(`gid://organization/ShopifyShop/${numericId}`).toString('base64url')
}

async function waitForStoreDeletionConfirmation(options: StoreDeletionConfirmationOptions): Promise<boolean> {
  const organizationsShopifyShopId = toOrganizationsShopifyShopId(options.shopifyShopId)

  return renderSingleTask({
    title: outputContent`Development store deletion requested. Waiting for deletion confirmation`,
    task: async (updateStatus) => {
      const startTime = Date.now()
      while (true) {
        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          return false
        }

        // eslint-disable-next-line no-await-in-loop
        const pollResult = await businessPlatformOrganizationsRequestDoc<
          OrganizationAccessibleShopQuery,
          OrganizationAccessibleShopQueryVariables
        >({
          query: OrganizationAccessibleShop,
          token: options.token,
          organizationId: options.organizationId,
          variables: {id: organizationsShopifyShopId},
          unauthorizedHandler: options.unauthorizedHandler,
        })

        const accessibleShop = pollResult.organization?.accessibleShop
        if (accessibleShop?.planName?.toLowerCase() === CANCELLED_PLAN_NAME.toLowerCase()) {
          return true
        }

        updateStatus(outputContent`${deletionPollStatus()}`)

        // eslint-disable-next-line no-await-in-loop
        await sleep(POLL_INTERVAL_SECONDS)
      }
    },
    renderOptions: {stdout: process.stderr},
  })
}

function deletionPollStatus(): string {
  return 'Waiting for deletion confirmation'
}

function deletionResultJson(options: {store: string; organization: Organization; deletionConfirmed: boolean}): string {
  const {store, organization, deletionConfirmed} = options
  return JSON.stringify(
    {
      store: {
        domain: store,
        deletionRequested: true,
        deletionConfirmed,
      },
      organization: {
        id: organization.id,
        name: organization.businessName,
      },
      ...(deletionConfirmed
        ? {}
        : {
            message:
              'Deletion was requested, but has not been confirmed yet. The store may still finish deleting asynchronously.',
          }),
    },
    null,
    2,
  )
}
