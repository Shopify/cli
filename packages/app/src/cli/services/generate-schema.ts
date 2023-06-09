import {fetchOrCreateOrganizationApp} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {
  ApiSchemaDefinitionQuery,
  ApiSchemaDefinitionQuerySchema,
  ApiSchemaDefinitionQueryVariables,
} from '../api/graphql/functions/api_schema_definition.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../models/extensions/specifications/function.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isTerminalInteractive} from '@shopify/cli-kit/node/context/local'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'

interface GenerateSchemaOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
}

export async function generateSchemaService(options: GenerateSchemaOptions) {
  const {extension, app} = options
  const token = await ensureAuthenticatedPartners()
  const {apiVersion: version, type} = extension.configuration
  let apiKey = options.apiKey || getAppIdentifiers({app}).app

  if (!apiKey) {
    if (!isTerminalInteractive()) {
      throw new AbortError(
        outputContent`No API key was provided.`,
        outputContent`Provide an API key with the --api-key flag.`,
      )
    }

    apiKey = (await fetchOrCreateOrganizationApp(app, token)).apiKey
  }

  const query = ApiSchemaDefinitionQuery
  const variables: ApiSchemaDefinitionQueryVariables = {
    apiKey,
    version,
    type,
  }
  const response: ApiSchemaDefinitionQuerySchema = await partnersRequest(query, token, variables)

  if (!response.definition) {
    throw new AbortError(
      outputContent`A schema could not be generated for ${extension.localIdentifier}`,
      outputContent`Check that the Function API type and version are valid.`,
    )
  }

  return response.definition
}
