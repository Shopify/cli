import {extensionGraphqlId, ExtensionTypes} from '../../constants.js'
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
  type: ExtensionTypes,
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
  return api.partners.request<api.graphql.ExtensionCreateSchema>(query, token, variables).match(
    (result) => {
      if (result.extensionCreate.userErrors?.length > 0) {
        const errors = result.extensionCreate.userErrors.map((error) => error.message).join(', ')
        throw new error.Abort(errors)
      }

      return result.extensionCreate.extensionRegistration
    },
    (error) => {
      throw error
    },
  )
}
