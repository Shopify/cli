import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {AppLinkedInterface, CurrentAppConfiguration} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../models/extensions/schemas.js'
import {OrganizationApp} from '../models/organization.js'
import {allMigrationChoices, getMigrationChoices} from '../prompts/import-extensions.js'
import {configurationFileNames} from '../constants.js'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {removeFile, writeFile} from '@shopify/cli-kit/node/fs'
import {outputContent} from '@shopify/cli-kit/node/output'
import {slugify} from '@shopify/cli-kit/common/string'
import {AbortError} from '@shopify/cli-kit/node/error'

export const allExtensionTypes = allMigrationChoices.flatMap((choice) => choice.extensionTypes)

interface ImportAllOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  extensions: ExtensionRegistration[]
}

interface ImportOptions extends ImportAllOptions {
  extensionTypes: string[]
  buildTomlObject: (
    ext: ExtensionRegistration,
    allExtensions: ExtensionRegistration[],
    appConfig: CurrentAppConfiguration,
  ) => string
  all?: boolean
}

export async function importExtensions(options: ImportOptions) {
  const {app, remoteApp, developerPlatformClient, extensionTypes, extensions, buildTomlObject, all} = options

  let extensionsToMigrate = extensions.filter((ext) => extensionTypes.includes(ext.type.toLowerCase()))

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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      extensionsToMigrate = [extensionsToMigrate.find((ext) => ext?.uuid === promptAnswer)!]
    }
  }

  const extensionUuids: IdentifiersExtensions = {}
  const importPromises = extensionsToMigrate.map(async (ext) => {
    const directory = await ensureExtensionDirectoryExists({app, name: ext.title})
    const tomlObject = buildTomlObject(ext, extensions, app.configuration)
    const path = joinPath(directory, 'shopify.extension.toml')
    await writeFile(path, tomlObject)
    const handle = slugify(ext.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH))
    extensionUuids[handle] = ext.uuid
    const lockFilePath = joinPath(directory, configurationFileNames.lockFile)
    await removeFile(lockFilePath)
    return {extension: ext, directory: joinPath('extensions', basename(directory))}
  })

  const generatedExtensions = await Promise.all(importPromises)
  renderSuccessMessages(generatedExtensions)
  await updateAppIdentifiers({
    app,
    identifiers: {
      extensions: extensionUuids,
      app: remoteApp.apiKey,
    },
    command: 'deploy',
    developerPlatformClient,
  })
}

export async function importAllExtensions(options: ImportAllOptions) {
  const migrationChoices = getMigrationChoices(options.extensions)
  await Promise.all(
    migrationChoices.map(async (choice) => {
      return importExtensions({
        ...options,
        extensionTypes: choice.extensionTypes,
        buildTomlObject: choice.buildTomlObject,
        all: true,
      })
    }),
  )
}

function renderSuccessMessages(generatedExtensions: {extension: ExtensionRegistration; directory: string}[]) {
  renderSuccess({
    headline: ['Imported the following extensions from the dashboard:'],
    body: generatedExtensions
      .map((gen) => {
        return outputContent`• "${gen.extension.title}" at: ${gen.directory}`.value
      })
      .join('\n'),
  })
}
