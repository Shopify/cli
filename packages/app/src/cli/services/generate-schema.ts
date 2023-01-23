import {fetchOrganizationAndFetchOrCreateApp} from './environment.js'
import {AppInterface} from '../models/app/app.js'
import {FunctionExtension} from '../models/app/extensions.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {
  ApiSchemaDefinitionQuery,
  ApiSchemaDefinitionQuerySchema,
  ApiSchemaDefinitionQueryVariables,
} from '../api/graphql/functions/api_schema_definition.js'
import * as output from '@shopify/cli-kit/node/output'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {isTerminalInteractive} from '@shopify/cli-kit/node/environment/local'
import {AbortError} from '@shopify/cli-kit/node/error'

interface GenerateSchemaOptions {
  app: AppInterface
  extension: FunctionExtension
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
        output.content`No API key was provided.`,
        output.content`Provide an API key with the --api-key flag.`,
      )
    }

    apiKey = (await fetchOrganizationAndFetchOrCreateApp(app, token)).partnersApp.apiKey
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
      output.content`A schema could not be generated for ${extension.localIdentifier}`,
      output.content`Check that the Function API type and version are valid.`,
    )
  }

  return response.definition
}
