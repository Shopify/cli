import {type GeneratedFunctionSchema} from './generate-schema/types.js'
import {prependSchemaVersionHeader} from './function/schema-version.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {SchemaDefinitionByApiTypeQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {SchemaDefinitionByTargetQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-target.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../models/extensions/specifications/function.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent} from '@shopify/cli-kit/node/output'
import {joinPath} from '@shopify/cli-kit/node/path'

interface GenerateSchemaOptions {
  app: AppLinkedInterface
  extension: ExtensionInstance<FunctionConfigType>
  developerPlatformClient: DeveloperPlatformClient
  orgId: string
}

export async function generateSchemaService(options: GenerateSchemaOptions): Promise<GeneratedFunctionSchema> {
  const {extension, developerPlatformClient, app, orgId} = options
  const apiKey = app.configuration.client_id
  const {api_version: version, type, targeting} = extension.configuration
  const usingTargets = Boolean(targeting?.length)
  const fetchedDefinition = await (usingTargets
    ? generateSchemaFromTarget({
        localIdentifier: extension.localIdentifier,
        developerPlatformClient,
        apiKey,

        target: targeting![0]!.target,
        version,
        orgId,
      })
    : generateSchemaFromApiType({
        localIdentifier: extension.localIdentifier,
        developerPlatformClient,
        apiKey,
        type,
        version,
        orgId,
      }))

  const definition = prependSchemaVersionHeader(fetchedDefinition, version)

  return {
    definition,
    path: joinPath(extension.directory, 'schema.graphql'),
    localIdentifier: extension.localIdentifier,
  }
}

interface BaseGenerateSchemaOptions {
  localIdentifier: string
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
  version: string
  orgId: string
}

interface GenerateSchemaFromTargetOptions extends BaseGenerateSchemaOptions {
  target: string
}

async function generateSchemaFromTarget({
  localIdentifier,
  developerPlatformClient,
  apiKey,
  target,
  version,
  orgId,
}: GenerateSchemaFromTargetOptions): Promise<string> {
  const variables: SchemaDefinitionByTargetQueryVariables = {
    handle: target,
    version,
  }
  // Api key required for partners reqs, can be removed once fully migrated to AMF
  const definition = await developerPlatformClient.targetSchemaDefinition(variables, apiKey, orgId)

  if (!definition) {
    throw new AbortError(
      outputContent`A schema could not be generated for ${localIdentifier}`,
      outputContent`Check that the Function targets and version are valid.`,
    )
  }

  return definition
}

interface GenerateSchemaFromType extends BaseGenerateSchemaOptions {
  type: string
}

async function generateSchemaFromApiType({
  localIdentifier,
  developerPlatformClient,
  apiKey,
  version,
  type,
  orgId,
}: GenerateSchemaFromType): Promise<string> {
  const variables: SchemaDefinitionByApiTypeQueryVariables = {
    version,
    type,
  }

  const definition = await developerPlatformClient.apiSchemaDefinition(variables, apiKey, orgId)

  if (!definition) {
    throw new AbortError(
      outputContent`A schema could not be generated for ${localIdentifier}`,
      outputContent`Check that the Function API type and version are valid.`,
    )
  }

  return definition
}
