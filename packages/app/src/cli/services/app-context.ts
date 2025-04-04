import {appFromIdentifiers} from './context.js'
import {getCachedAppInfo, setCachedAppInfo} from './local-storage.js'
import {fetchSpecifications} from './generate/fetch-extension-specifications.js'
import link from './app/config/link.js'
import {fetchOrgFromId} from './dev/fetch.js'
import {addUidToTomlsIfNecessary} from './app/add-uid-to-extension-toml.js'
import {Organization, OrganizationApp, OrganizationSource} from '../models/organization.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {getAppConfigurationState, loadAppUsingConfigurationState} from '../models/app/loader.js'
import {RemoteAwareExtensionSpecification} from '../models/extensions/specification.js'
import {AppLinkedInterface} from '../models/app/app.js'
import metadata from '../metadata.js'
import {FlattenedRemoteSpecification} from '../api/graphql/extension_specifications.js'
import {SettingsSchemaAsJson} from '../models/extensions/schemas.js'
import {tryParseInt} from '@shopify/cli-kit/common/string'
import {mkdir, fileExists, writeFile, removeFile, readdir} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {outputInfo} from '@shopify/cli-kit/node/output'

export interface LoadedAppContextOutput {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  organization: Organization
  specifications: RemoteAwareExtensionSpecification[]
}

/**
 * Input options for the `linkedAppContext` function.
 *
 * @param directory - The directory containing the app.
 * @param forceRelink - Whether to force a relink of the app, this includes re-selecting the remote org and app.
 * @param clientId - The client ID to use when linking the app or when fetching the remote app.
 * @param userProvidedConfigName - The name of an existing config file in the app, if not provided, the cached/default one will be used.
 * @param unsafeReportMode - DONT USE THIS UNLESS YOU KNOW WHAT YOU ARE DOING. It means that the app loader will not throw an error when the app/extension configuration is invalid.
 * It is recommended to always use 'strict' mode unless the command can work with invalid configurations (like app info).
 */
interface LoadedAppContextOptions {
  directory: string
  forceRelink: boolean
  clientId: string | undefined
  userProvidedConfigName: string | undefined
  unsafeReportMode?: boolean
}

/**
 * Stores JSON schemas from extension specifications in the .shopify/schemas directory
 *
 * @param specifications - The list of extension specifications
 * @param directory - The app directory where .shopify folder will be created
 */
export async function refreshSchemaBank(
  specifications: RemoteAwareExtensionSpecification[],
  directory: string,
): Promise<void> {
  const schemaDir = joinPath(directory, '.shopify', 'schemas')

  // Create schemas subdirectory
  if (!(await fileExists(schemaDir))) {
    await mkdir(schemaDir)
  }

  // Get list of expected schema file names based on specifications
  const expectedSchemaFiles = new Set(specifications.map((spec) => `${spec.identifier}.schema.json`))
  expectedSchemaFiles.add('app.schema.json')
  expectedSchemaFiles.add('extension.schema.json')
  // Prepare all the schema writing promises
  const writePromises = specifications.map((spec) => {
    // Cast to include FlattenedRemoteSpecification to access validationSchema
    const flattenedSpec = spec as RemoteAwareExtensionSpecification & FlattenedRemoteSpecification
    // First check if there's a hardcoded schema, then fall back to validationSchema
    const schema = flattenedSpec.hardcodedInputJsonSchema ?? flattenedSpec.validationSchema?.jsonSchema
    if (schema) {
      const schemaFilePath = joinPath(schemaDir, `${spec.identifier}.schema.json`)
      // Parse and re-stringify to ensure pretty printing
      const prettySchema = JSON.stringify(JSON.parse(schema), null, 2)
      return writeFile(schemaFilePath, prettySchema)
    }
    return Promise.resolve()
  })

  const combinedConfigSchema = generateCombinedConfigSchema(specifications)
  const combinedExtensionSchema = generateCombinedExtensionSchema(specifications)
  // combined config schema should be written to the .shopify/schemas directory
  const combinedConfigSchemaPath = joinPath(directory, '.shopify', 'schemas', 'app.schema.json')
  await writeFile(combinedConfigSchemaPath, JSON.stringify(combinedConfigSchema, null, 2))

  const combinedExtensionSchemaPath = joinPath(directory, '.shopify', 'schemas', 'extension.schema.json')
  await writeFile(combinedExtensionSchemaPath, JSON.stringify(combinedExtensionSchema, null, 2))

  // Execute all write operations in parallel
  await Promise.all(writePromises)

  // Clean up old schema files that are no longer in the specifications
  const existingFiles = await readdir(schemaDir)
  const cleanupPromises = existingFiles
    .filter((filename: string) => filename.endsWith('.schema.json') && !expectedSchemaFiles.has(filename))
    .map((filename: string) => removeFile(joinPath(schemaDir, filename)))

  if (cleanupPromises.length > 0) {
    await Promise.all(cleanupPromises)
  }

  // make a copy with a name incl. the timestamp and output the path
  const timestamp = new Date().toISOString().replace(/[-:Z]/g, '')
  const combinedConfigSchemaPathWithTimestamp = joinPath(
    directory,
    '.shopify',
    'schemas',
    `app-${timestamp}.schema.json`,
  )
  await writeFile(combinedConfigSchemaPathWithTimestamp, JSON.stringify(combinedConfigSchema, null, 2))
  // TODO drop this in real use
  outputInfo(`Combined config schema written to: ${combinedConfigSchemaPathWithTimestamp}`)

  const combinedExtensionSchemaPathWithTimestamp = joinPath(
    directory,
    '.shopify',
    'schemas',
    `extension-${timestamp}.schema.json`,
  )
  await writeFile(combinedExtensionSchemaPathWithTimestamp, JSON.stringify(combinedExtensionSchema, null, 2))
  // TODO drop this in real use
  outputInfo(`Combined extension schema written to: ${combinedExtensionSchemaPathWithTimestamp}`)
}

function generateCombinedConfigSchema(specifications: RemoteAwareExtensionSpecification[]) {
  const configModules = specifications.filter(
    (spec) => spec.uidStrategy !== 'uuid',
  ) as (RemoteAwareExtensionSpecification & FlattenedRemoteSpecification)[]

  const combinedConfigSchema = {
    type: 'object',
    properties: {
      client_id: {type: 'string'},
      organization_id: {type: 'string'},
      build: {type: 'object', additionalProperties: true},
    },
    required: ['client_id'],
    additionalProperties: false,
  }

  for (const spec of configModules) {
    const schema = spec.hardcodedInputJsonSchema ?? spec.validationSchema?.jsonSchema
    if (!schema) continue
    const jsonSchemaContent = JSON.parse(schema)

    // merge this schema's properties into the combinedConfigSchema
    combinedConfigSchema.properties = {...combinedConfigSchema.properties, ...jsonSchemaContent.properties}
    combinedConfigSchema.required = [...combinedConfigSchema.required, ...(jsonSchemaContent.required ?? [])]
  }
  return combinedConfigSchema
}

function generateCombinedExtensionSchema(specifications: RemoteAwareExtensionSpecification[]) {
  const extensionModules = specifications.filter(
    (spec) => spec.uidStrategy === 'uuid',
  ) as (RemoteAwareExtensionSpecification & FlattenedRemoteSpecification)[]

  const combinedExtensionSchema = {
    type: 'object',
    properties: {
      api_version: {type: 'string'},
      description: {type: 'string'},
      settings: SettingsSchemaAsJson,
      extensions: {
        type: 'array',
        items: {
          type: 'object',
          discriminator: {propertyName: 'type'},
          required: ['type'],
          oneOf: [] as object[],
        },
      },
    },
    required: ['api_version', 'extensions'],
    additionalProperties: false,
  }

  for (const spec of extensionModules) {
    const schema = spec.hardcodedInputJsonSchema ?? spec.validationSchema?.jsonSchema
    if (!schema) continue
    const jsonSchemaContent = JSON.parse(schema)

    // each schema is added to the oneOf array
    combinedExtensionSchema.properties.extensions.items.oneOf.push(jsonSchemaContent)
  }

  return combinedExtensionSchema
}

/**
 * This function always returns an app that has been correctly linked and was loaded using the remote specifications.
 *
 * You can use a custom configName to load a specific config file.
 * In any case, if the selected config file is not linked, this function will force a link.
 *
 * @returns The local app, the remote app, the correct developer platform client, and the remote specifications list.
 */
export async function linkedAppContext({
  directory,
  clientId,
  forceRelink,
  userProvidedConfigName,
  unsafeReportMode = false,
}: LoadedAppContextOptions): Promise<LoadedAppContextOutput> {
  // Get current app configuration state
  let configState = await getAppConfigurationState(directory, userProvidedConfigName)
  let remoteApp: OrganizationApp | undefined

  // If the app is not linked, force a link.
  if (configState.state === 'template-only' || forceRelink) {
    const result = await link({directory, apiKey: clientId, configName: configState.configurationFileName})
    remoteApp = result.remoteApp
    configState = result.state
  }

  // If the clientId is provided, update the configuration state with the new clientId
  if (clientId && clientId !== configState.basicConfiguration.client_id) {
    configState.basicConfiguration.client_id = clientId
  }

  // Fetch the remote app, using a different clientID if provided via flag.
  // Then update the current developerPlatformClient with the one from the remoteApp
  let developerPlatformClient = selectDeveloperPlatformClient({configuration: configState.basicConfiguration})
  if (!remoteApp) {
    const apiKey = configState.basicConfiguration.client_id
    const organizationId = configState.basicConfiguration.organization_id
    remoteApp = await appFromIdentifiers({apiKey, developerPlatformClient, organizationId})
  }
  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const organization = await fetchOrgFromId(remoteApp.organizationId, developerPlatformClient)

  // Fetch the remote app's specifications
  const specifications = await fetchSpecifications({developerPlatformClient, app: remoteApp})

  // Load the local app using the configuration state and the remote app's specifications
  const localApp = await loadAppUsingConfigurationState(configState, {
    specifications,
    remoteFlags: remoteApp.flags,
    mode: unsafeReportMode ? 'report' : 'strict',
  })

  // If the remoteApp is the same as the linked one, update the cached info.
  const cachedInfo = getCachedAppInfo(directory)
  const rightApp = remoteApp.apiKey === localApp.configuration.client_id
  if (!cachedInfo || rightApp) {
    setCachedAppInfo({appId: remoteApp.apiKey, title: remoteApp.title, directory, orgId: remoteApp.organizationId})
  }

  await logMetadata(remoteApp, organization, forceRelink)

  // Add UIDs to extension TOML files if using app-management.
  // If in unsafe report mode, it is possible the UIDs are not loaded in memory
  // even if they are present in the file, so we can't be sure whether or not
  // it's necessary.
  if (!unsafeReportMode) {
    await addUidToTomlsIfNecessary(localApp.allExtensions, developerPlatformClient)
  }

  // Store JSON schemas in the .shopify directory
  await refreshSchemaBank(specifications, directory)

  return {app: localApp, remoteApp, developerPlatformClient, specifications, organization}
}

async function logMetadata(app: {apiKey: string}, organization: Organization, resetUsed: boolean) {
  let organizationInfo: {partner_id?: number; business_platform_id?: number}
  if (organization.source === OrganizationSource.BusinessPlatform) {
    organizationInfo = {business_platform_id: tryParseInt(organization.id)}
  } else {
    organizationInfo = {partner_id: tryParseInt(organization.id)}
  }

  await metadata.addPublicMetadata(() => ({
    ...organizationInfo,
    api_key: app.apiKey,
    cmd_app_reset_used: resetUsed,
  }))
}
