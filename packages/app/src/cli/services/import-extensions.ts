import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {getExtensions} from './fetch-extensions.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../models/extensions/schemas.js'
import {OrganizationApp} from '../models/organization.js'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputContent} from '@shopify/cli-kit/node/output'
import {slugify} from '@shopify/cli-kit/common/string'

interface ImportOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  extensionTypes: string[]
  buildTomlObject: (ext: ExtensionRegistration, allExtensions: ExtensionRegistration[]) => string
}

export async function importExtensions(options: ImportOptions) {
  const {remoteApp, developerPlatformClient} = options

  const initialRemoteExtensions = await developerPlatformClient.appExtensionRegistrations({
    id: remoteApp.apiKey,
    apiKey: remoteApp.apiKey,
    organizationId: remoteApp.organizationId,
  })
  const {extensionRegistrations} = initialRemoteExtensions.app
  const extensions = await getExtensions({
    developerPlatformClient,
    apiKey: remoteApp.apiKey,
    organizationId: remoteApp.organizationId,
    extensionTypes: options.extensionTypes,
  })

  if (extensions.length === 0) {
    renderSuccess({headline: ['No extensions to migrate.']})
    return
  }

  const choices = extensions.map((ext) => {
    return {label: ext.title, value: ext.uuid}
  })
  choices.push({label: 'All', value: 'All'})
  const promptAnswer = await renderSelectPrompt({message: 'Extensions to migrate', choices})

  const extensionsToMigrate =
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    promptAnswer === 'All' ? extensions : [extensions.find((ext) => ext?.uuid === promptAnswer)!]

  const extensionUuids: IdentifiersExtensions = {}
  const importPromises = extensionsToMigrate.map(async (ext) => {
    const directory = await ensureExtensionDirectoryExists({app: options.app, name: ext.title})
    const tomlObject = options.buildTomlObject(ext, extensionRegistrations)
    const path = joinPath(directory, 'shopify.extension.toml')
    await writeFile(path, tomlObject)
    const handle = slugify(ext.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH))
    extensionUuids[handle] = ext.uuid
    return {extension: ext, directory: joinPath('extensions', basename(directory))}
  })

  const generatedExtensions = await Promise.all(importPromises)
  renderSuccessMessages(generatedExtensions)
  await updateAppIdentifiers({
    app: options.app,
    identifiers: {
      extensions: extensionUuids,
      app: remoteApp.apiKey,
    },
    command: 'deploy',
    developerPlatformClient,
  })
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
