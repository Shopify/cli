import {
  ExtensionImportCompletion,
  ImportedDashboardExtension,
  ImportExtensionsResult,
} from './import-extensions/types.js'
import {renderImportExtensionsResult} from './import-extensions/result.js'
import {AppLinkedInterface, CurrentAppConfiguration} from '../models/app/app.js'
import {updateAppIdentifiers, ExtensionUuidsByLocalIdentifier} from '../models/app/identifiers.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../models/extensions/schemas.js'
import {OrganizationApp} from '../models/organization.js'
import {allMigrationChoices, getMigrationChoices} from '../prompts/import-extensions.js'
import {configurationFileNames, blocks} from '../constants.js'
import {renderSelectPrompt} from '@shopify/cli-kit/node/ui'
import {joinPath} from '@shopify/cli-kit/node/path'
import {removeFile, fileExists, mkdir, touchFile} from '@shopify/cli-kit/node/fs'
import {TomlFile} from '@shopify/cli-kit/node/toml/toml-file'
import {JsonMapType} from '@shopify/cli-kit/node/toml'
import {slugify, hyphenate} from '@shopify/cli-kit/common/string'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'

export const allExtensionTypes = allMigrationChoices.flatMap((choice) => choice.extensionTypes)

interface ImportAllOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  extensions: ExtensionRegistration[]
}

interface ImportOptions extends ImportAllOptions {
  extensionTypes: string[]
  buildExtensionConfig: (
    ext: ExtensionRegistration,
    allExtensions: ExtensionRegistration[],
    appConfig: CurrentAppConfiguration,
  ) => object
  all?: boolean
}

enum DirectoryAction {
  Write = 'write',
  Skip = 'skip',
  Cancel = 'cancel',
}

/**
 * Handles extension directory creation during import with user prompts for existing directories
 */
async function handleExtensionDirectory({
  name,
  app,
}: {
  name: string
  app: AppLinkedInterface
}): Promise<{directory: string; action: DirectoryAction}> {
  const hyphenizedName = hyphenate(name)
  const extensionDirectory = joinPath(app.directory, blocks.extensions.directoryName, hyphenizedName)

  if (await fileExists(extensionDirectory)) {
    const choices = [
      {label: 'Overwrite local TOML with remote configuration', value: DirectoryAction.Write},
      {label: 'Keep local TOML', value: DirectoryAction.Skip},
      {label: 'Cancel', value: DirectoryAction.Cancel},
    ]

    const action = await renderSelectPrompt({
      message: `Directory "${hyphenizedName}" already exists. What would you like to do?`,
      choices,
    })

    return {directory: extensionDirectory, action}
  }

  // Directory doesn't exist, create it
  await mkdir(extensionDirectory)
  await touchFile(joinPath(extensionDirectory, configurationFileNames.lockFile))
  return {directory: extensionDirectory, action: DirectoryAction.Write}
}

export class ExtensionImportCancelledError extends AbortSilentError {
  constructor(
    private readonly pendingImports: Promise<ImportedDashboardExtension>[],
    private readonly selectedExtensions: ExtensionRegistration[],
  ) {
    super()
  }

  completedImports(): Promise<ExtensionImportCompletion> {
    return completeStartedImports(this.pendingImports, this.selectedExtensions)
  }
}

export class ExtensionImportFailedError extends Error {
  constructor(
    readonly originalError: unknown,
    private readonly pendingImports: Promise<ImportedDashboardExtension>[],
    private readonly selectedExtensions: ExtensionRegistration[],
  ) {
    super(originalError instanceof Error ? originalError.message : 'Dashboard extension import failed')
  }

  completedImports(): Promise<ExtensionImportCompletion> {
    return completeStartedImports(this.pendingImports, this.selectedExtensions)
  }
}

async function completeStartedImports(
  pendingImports: Promise<ImportedDashboardExtension>[],
  selectedExtensions: ExtensionRegistration[],
): Promise<ExtensionImportCompletion> {
  const results = await Promise.allSettled(pendingImports)
  return {
    extensions: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
    failures: results.flatMap((result, index) =>
      result.status === 'rejected' && !(result.reason instanceof ExtensionImportCancelledError)
        ? [{extension: selectedExtensions[index]!, error: result.reason as unknown}]
        : [],
    ),
  }
}

export async function importExtensions(options: ImportOptions): Promise<ImportExtensionsResult> {
  const {app, extensionTypes, extensions, buildExtensionConfig, all} = options

  let extensionsToMigrate = extensions.filter((ext) => extensionTypes.includes(ext.type.toLowerCase()))
  extensionsToMigrate = filterOutImportedExtensions(app, extensionsToMigrate)

  if (extensionsToMigrate.length === 0) {
    throw new AbortError('No extensions to migrate')
  }

  if (!all) {
    const choices = extensionsToMigrate.map((ext) => {
      return {label: ext.title, value: ext.uuid}
    })

    if (extensionsToMigrate.length > 1) {
      choices.push({label: 'All', value: 'All'})
    }
    const promptAnswer = await renderSelectPrompt({message: 'Extensions to migrate', choices})

    if (promptAnswer !== 'All') {
      extensionsToMigrate = [extensionsToMigrate.find((ext) => ext?.uuid === promptAnswer)!]
    }
  }

  const extensionUuids: ExtensionUuidsByLocalIdentifier = {}
  const importPromises: Promise<ImportedDashboardExtension>[] = extensionsToMigrate.map(async (ext) => {
    const {directory, action} = await handleExtensionDirectory({app, name: ext.title})

    if (action === DirectoryAction.Cancel) {
      throw new ExtensionImportCancelledError(importPromises, extensionsToMigrate)
    }

    const handle = slugify(ext.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH))
    extensionUuids[handle] = ext.uuid

    const tomlPath = joinPath(directory, 'shopify.extension.toml')
    if (action === DirectoryAction.Write) {
      const tomlContent = buildExtensionConfig(ext, extensions, app.configuration)
      const file = new TomlFile(tomlPath, tomlContent as JsonMapType)
      await file.replace(tomlContent as JsonMapType)
      const lockFilePath = joinPath(directory, configurationFileNames.lockFile)
      await removeFile(lockFilePath)
    }

    return {
      extension: ext,
      directory,
      configurationPath: action === DirectoryAction.Write || (await fileExists(tomlPath)) ? tomlPath : null,
      changed: action === DirectoryAction.Write,
    }
  })

  try {
    const generatedExtensions = await Promise.all(importPromises)
    return {extensions: generatedExtensions, extensionUuids}
  } catch (error) {
    if (error instanceof ExtensionImportCancelledError) throw error
    throw new ExtensionImportFailedError(error, importPromises, extensionsToMigrate)
  }
}

// import-extensions updates the .env file with the new UUIDs. we can use that to know if an extension was already imported.
// From the app loaded extensions, get the UUID and compare with the pending extensions.
export function filterOutImportedExtensions(app: AppLinkedInterface, extensions: ExtensionRegistration[]) {
  const cachedUUIDs = app.dotenv?.variables ?? {}
  const localExtensionUUIDs = app.allExtensions.map((ext) => cachedUUIDs[ext.idEnvironmentVariableName])
  return extensions.filter((ext) => !localExtensionUUIDs.includes(ext.uuid))
}

export async function importAllExtensions(options: ImportAllOptions) {
  const migrationChoices = getMigrationChoices(options.extensions)
  await Promise.all(
    migrationChoices.map(async (choice) => {
      const result = await importExtensions({
        ...options,
        extensionTypes: choice.extensionTypes,
        buildExtensionConfig: choice.buildExtensionConfig,
        all: true,
      }).catch((error: unknown) => {
        throw error instanceof ExtensionImportFailedError ? error.originalError : error
      })
      renderImportExtensionsResult(result.extensions)
      await updateAppIdentifiers({
        app: options.app,
        appApiKey: options.remoteApp.apiKey,
        extensionUuids: result.extensionUuids,
        command: 'import-extensions',
      })
    }),
  )
}
