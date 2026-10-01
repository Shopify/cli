import {prependSchemaVersionHeader} from './function/schema-version.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {SchemaDefinitionByApiTypeQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-api-type.js'
import {SchemaDefinitionByTargetQueryVariables} from '../api/graphql/functions/generated/schema-definition-by-target.js'
import {ExtensionInstance} from '../models/extensions/extension-instance.js'
import {FunctionConfigType} from '../models/extensions/specifications/function.js'
import {AbortError} from '@shopify/cli-kit/node/error'
import {outputContent, outputInfo, outputResult} from '@shopify/cli-kit/node/output'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

interface GenerateSchemaOptions {
  appId: string
  extension: ExtensionInstance<FunctionConfigType>
  stdout: boolean
  developerPlatformClient: DeveloperPlatformClient
  orgId: string
}

export async function generateSchemaService(options: GenerateSchemaOptions) {
  const {extension, stdout, developerPlatformClient, appId, orgId} = options
  const {api_version: version, type, targeting} = extension.configuration
  const usingTargets = Boolean(targeting?.length)
  const fetchedDefinition = await (usingTargets
    ? generateSchemaFromTarget({
        localIdentifier: extension.localIdentifier,
        developerPlatformClient,
        appId,
        target: targeting![0]!.target,
        version,
        orgId,
      })
    : generateSchemaFromApiType({
        localIdentifier: extension.localIdentifier,
        developerPlatformClient,
        appId,
        type,
        version,
        orgId,
      }))

  const definition = prependSchemaVersionHeader(fetchedDefinition, version)

  if (stdout) {
    outputResult(definition)
  } else {
    const outputPath = joinPath(extension.directory, 'schema.graphql')
    await writeFile(outputPath, definition)
    outputInfo(`GraphQL Schema for ${extension.localIdentifier} written to ${outputPath}`)
  }
}

interface BaseGenerateSchemaOptions {
  localIdentifier: string
  developerPlatformClient: DeveloperPlatformClient
  appId: string
  version: string
  orgId: string
}

interface GenerateSchemaFromTargetOptions extends BaseGenerateSchemaOptions {
  target: string
}

async function generateSchemaFromTarget({
  localIdentifier,
  developerPlatformClient,
  appId,
  target,
  version,
  orgId,
}: GenerateSchemaFromTargetOptions): Promise<string> {
  const variables: SchemaDefinitionByTargetQueryVariables = {
    handle: target,
    version,
  }
  const definition = await developerPlatformClient.targetSchemaDefinition(variables, appId, orgId)

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
  appId,
  version,
  type,
  orgId,
}: GenerateSchemaFromType): Promise<string> {
  const variables: SchemaDefinitionByApiTypeQueryVariables = {
    version,
    type,
  }

  const definition = await developerPlatformClient.apiSchemaDefinition(variables, appId, orgId)

  if (!definition) {
    throw new AbortError(
      outputContent`A schema could not be generated for ${localIdentifier}`,
      outputContent`Check that the Function API type and version are valid.`,
    )
  }

  return definition
}
