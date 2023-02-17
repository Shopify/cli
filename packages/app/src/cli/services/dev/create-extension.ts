import {
  ExtensionCreateQuery,
  ExtensionCreateSchema,
  ExtensionCreateVariables,
} from '../../api/graphql/extension_create.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'

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
  graphQLType: string,
  name: string,
  token: string,
): Promise<ExtensionRegistration> {
  const query = ExtensionCreateQuery
  const variables: ExtensionCreateVariables = {
    apiKey,
    type: graphQLType,
    title: name,
    config: JSON.stringify({}),
    context: null,
  }
  const result: ExtensionCreateSchema = await partnersRequest(query, token, variables)

  if (result.extensionCreate.userErrors?.length > 0) {
    const errors = result.extensionCreate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  return result.extensionCreate.extensionRegistration
}
