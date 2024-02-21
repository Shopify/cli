import {fetchOrCreateOrganizationApp} from './context.js'
import {selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {AppInterface} from '../models/app/app.js'
import {getAppIdentifiers} from '../models/app/identifiers.js'
import {
  ApiSchemaDefinitionQuery,
  ApiSchemaDefinitionQuerySchema,
  ApiSchemaDefinitionQueryVariables,
} from '../api/graphql/functions/api_schema_definition.js'
import {
  TargetSchemaDefinitionQuery,
  TargetSchemaDefinitionQuerySchema,
  TargetSchemaDefinitionQueryVariables,
} from '../api/graphql/functions/target_schema_definition.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../models/extensions/specifications/function.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
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
  const developerPlatformClient = selectDeveloperPlatformClient()
  const token = (await developerPlatformClient.session()).token
  const {api_version: version, type, targeting} = extension.configuration
  let apiKey = options.apiKey || getAppIdentifiers({app}).app
  const stdout = options.stdout

  if (!apiKey) {
    if (!isTerminalInteractive()) {
      throw new AbortError(
        outputContent`No Client ID was provided.`,
        outputContent`Provide a Client ID with the --client-id flag.`,
      )
    }

    apiKey = (await fetchOrCreateOrganizationApp(app, developerPlatformClient)).apiKey
  }

  const usingTargets = Boolean(targeting?.length)
  const definition = await (usingTargets
    ? generateSchemaFromTarget({
        localIdentifier: extension.localIdentifier,
        token,
        apiKey,
        target: targeting![0]!.target,
        version,
      })
    : generateSchemaFromType({localIdentifier: extension.localIdentifier, token, apiKey, type, version}))

  if (stdout) {
    outputInfo(definition)
  } else {
    const outputPath = joinPath(options.path, 'schema.graphql')
    await writeFile(outputPath, definition)
    outputInfo(`GraphQL Schema for ${extension.localIdentifier} written to ${outputPath}`)
  }
}

interface BaseGenerateSchemaOptions {
  localIdentifier: string
  token: string
  apiKey: string
  version: string
}

interface GenerateSchemaFromTargetOptions extends BaseGenerateSchemaOptions {
  target: string
}

async function generateSchemaFromTarget({
  localIdentifier,
  token,
  apiKey,
  target,
  version,
}: GenerateSchemaFromTargetOptions): Promise<string> {
  const query = TargetSchemaDefinitionQuery
  const variables: TargetSchemaDefinitionQueryVariables = {
    apiKey,
    target,
    version,
  }
  const response: TargetSchemaDefinitionQuerySchema = await partnersRequest(query, token, variables)

  if (!response.definition) {
    throw new AbortError(
      outputContent`A schema could not be generated for ${localIdentifier}`,
      outputContent`Check that the Function targets and version are valid.`,
    )
  }

  return response.definition
}

interface GenerateSchemaFromType extends BaseGenerateSchemaOptions {
  type: string
}

async function generateSchemaFromType({
  localIdentifier,
  token,
  apiKey,
  version,
  type,
}: GenerateSchemaFromType): Promise<string> {
  const query = ApiSchemaDefinitionQuery
  const variables: ApiSchemaDefinitionQueryVariables = {
    apiKey,
    version,
    type,
  }
  const response: ApiSchemaDefinitionQuerySchema = await partnersRequest(query, token, variables)

  if (!response.definition) {
    throw new AbortError(
      outputContent`A schema could not be generated for ${localIdentifier}`,
      outputContent`Check that the Function API type and version are valid.`,
    )
  }

  return response.definition
}
