import {extensionGraphqlId} from '../../constants.js'
import {api, error} from '@shopify/cli-kit'

export interface ExtensionRegistration {
  id: string
  uuid: string
  type: string
  title: string
  draftVersion?: {
    registrationId: string
    lastUserInteractionAt: string
    validationErrors: {
      field: string[]
      message: string
    }[]
  }
}

export async function createExtension(
  apiKey: string,
  type: string,
  name: string,
  token: string,
): Promise<ExtensionRegistration> {
  const query = api.graphql.ExtensionCreateQuery
  const variables: api.graphql.ExtensionCreateVariables = {
    apiKey,
    type: extensionGraphqlId(type),
    title: name,
    config: JSON.stringify({}),
    context: null,
  }
  const result: api.graphql.ExtensionCreateSchema = await api.partners.request(query, token, variables)

  if (result.extensionCreate.userErrors?.length > 0) {
    const errors = result.extensionCreate.userErrors.map((error) => error.message).join(', ')
    throw new error.Abort(errors)
  }

  return result.extensionCreate.extensionRegistration
}
