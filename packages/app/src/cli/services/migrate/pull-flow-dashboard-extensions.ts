import {
  FetchExtensionQueryVariables,
  FetchExtensionQuery,
  FetchExtensionQuerySchema,
} from '../../api/graphql/extension_configurations.js'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

export async function fetchExtension(uuid: string, appId: string, type: string): Promise<FetchExtensionQuerySchema> {
  const token = await ensureAuthenticatedPartners()
  const variables: FetchExtensionQueryVariables = {
    uuid,
    appId,
    type,
  }
  return partnersRequest(FetchExtensionQuery, token, variables)
}
