import {DeleteAppDevelopmentStore} from '../../../api/graphql/business-platform-organizations/generated/delete_app_development_store.js'
import {selectOrg} from '@shopify/organizations'
import {businessPlatformOrganizationsRequestDoc} from '@shopify/cli-kit/node/api/business-platform'
import {ensureAuthenticatedBusinessPlatform} from '@shopify/cli-kit/node/session'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

interface DeleteDevStoreOptions {
  store: string
  organization?: string
  json: boolean
}

export async function deleteDevStore(options: DeleteDevStoreOptions): Promise<void> {
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
    query: DeleteAppDevelopmentStore,
    token,
    organizationId: org.id,
    variables: {storeFqdn: options.store},
    unauthorizedHandler,
  })

  const deleteAppDevelopmentStore = mutationResult.deleteAppDevelopmentStore
  if (!deleteAppDevelopmentStore) {
    throw new AbortError('Store deletion failed: unexpected response')
  }

  const userErrors = deleteAppDevelopmentStore.userErrors
  if (userErrors && userErrors.length > 0) {
    const messages = userErrors.map((e) => e.message).join(', ')
    throw new AbortError(`Failed to delete development store: ${messages}`)
  }

  if (options.json) {
    outputResult(
      JSON.stringify(
        {
          status: 'deleted',
          store: options.store,
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
      headline: `Development store "${options.store}" deleted successfully.`,
    })
  }
}
