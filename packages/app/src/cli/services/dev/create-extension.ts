import {ExtensionCreateSchema, ExtensionCreateVariables} from '../../api/graphql/extension_create.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface ExtensionRegistration {
  id: string
  uuid: string
  type: string
  title: string
  draftVersion?: {
    config: string
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
  handle: string,
  developerPlatformClient: DeveloperPlatformClient,
  context?: string,
): Promise<ExtensionRegistration> {
  const variables: ExtensionCreateVariables = {
    apiKey,
    type: graphQLType,
    title: handle,
    config: JSON.stringify({}),
    context: context ?? null,
    handle,
  }
  const result: ExtensionCreateSchema = await developerPlatformClient.createExtension(variables)

  if (result.extensionCreate.userErrors?.length > 0) {
    const errors = result.extensionCreate.userErrors.map((error) => error.message).join(', ')
    throw new AbortError(errors)
  }

  return result.extensionCreate.extensionRegistration
}
