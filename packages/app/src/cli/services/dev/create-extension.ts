import {api, error} from '@shopify/cli-kit'
import {ExtensionCreateVariables} from '$../../cli-kit/src/api/graphql'
import {ExtensionTypes} from '$cli/constants'

interface ExtensionRegistration {
  id: string
  uuid: string
  type: string
  title: string
  draftVersion: {
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
  const variables: ExtensionCreateVariables = {
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

/**
 * Each extension has a different ID in graphQL.
 * Sometimes the ID is the same as the type, sometimes it's different.
 * @param type {string} The extension type
 * @returns {string} The extension GraphQL ID
 */
const extensionGraphqlId = (type: ExtensionTypes) => {
  switch (type) {
    case 'product_subscription':
      return 'SUBSCRIPTION_MANAGEMENT'
    case 'checkout_ui_extension':
      return 'CHECKOUT_UI_EXTENSION'
    case 'checkout_post_purchase':
      return 'CHECKOUT_POST_PURCHASE'
    case 'theme':
      return 'THEME_APP_EXTENSION'
    default:
      // As we add new extensions, this bug will force us to add a new case here.
      throw new error.Bug('Unknown extension type')
  }
}
