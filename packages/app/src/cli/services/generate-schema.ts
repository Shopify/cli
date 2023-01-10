import {fetchOrganizationAndFetchOrCreateApp} from './environment.js'
import {AppInterface} from '../models/app/app.js'
import {FunctionExtension} from '../models/app/extensions.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {session, output, api, error, environment} from '@shopify/cli-kit'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'

interface GenerateSchemaOptions {
  app: AppInterface
  extension: FunctionExtension
  apiKey?: string
}

export async function generateSchemaService(options: GenerateSchemaOptions) {
  const {extension, app} = options
  const token = await session.ensureAuthenticatedPartners()
  const {apiVersion: version, type} = extension.configuration
  let apiKey = options.apiKey || getAppIdentifiers({app}).app

  if (!apiKey) {
    if (!environment.local.isTerminalInteractive()) {
      throw new error.Abort(
        output.content`No API key was provided.`,
        output.content`Provide an API key with the --api-key flag.`,
      )
    }

    apiKey = (await fetchOrganizationAndFetchOrCreateApp(app, token)).partnersApp.apiKey
  }

  const query = api.graphql.ApiSchemaDefinitionQuery
  const variables: api.graphql.ApiSchemaDefinitionQueryVariables = {
    apiKey,
    version,
    type,
  }
  const response: api.graphql.ApiSchemaDefinitionQuerySchema = await partnersRequest(query, token, variables)

  if (!response.definition) {
    throw new error.Abort(
      output.content`A schema could not be generated for ${extension.localIdentifier}`,
      output.content`Check that the Function API type and version are valid.`,
    )
  }

  return response.definition
}
