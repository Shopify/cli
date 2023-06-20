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
import {outputContent, outputInfo} from '@shopify/cli-kit/node/output'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

interface GenerateSchemaOptions {
  app: AppInterface
  extension: ExtensionInstance<FunctionConfigType>
  apiKey?: string
  stdout: boolean
  path: string
}

export async function generateSchemaService(options: GenerateSchemaOptions) {
  const {extension, app} = options
  const token = await ensureAuthenticatedPartners()
  const {api_version: version, type} = extension.configuration
  let apiKey = options.apiKey || getAppIdentifiers({app}).app
  const stdout = options.stdout

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

  if (stdout) {
    outputInfo(response.definition)
  } else {
    const outputPath = joinPath(options.path, 'schema.graphql')
    await writeFile(outputPath, response.definition)
    outputInfo(`GraphQL Schema for ${extension.localIdentifier} written to ${outputPath}`)
  }
}
