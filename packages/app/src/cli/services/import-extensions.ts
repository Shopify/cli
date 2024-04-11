import {fetchAppAndIdentifiers, logMetadataForLoadedContext} from './context.js'
import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {getExtensions} from './fetch-extensions.js'
import {AppInterface} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputContent} from '@shopify/cli-kit/node/output'

interface ImportOptions {
  app: AppInterface
  apiKey?: string
  developerPlatformClient?: DeveloperPlatformClient
  extensionTypes: string[]
  buildTomlObject: (ext: ExtensionRegistration, allExtensions: ExtensionRegistration[]) => string
}

export async function importExtensions(options: ImportOptions) {
  const developerPlatformClient = options.developerPlatformClient ?? selectDeveloperPlatformClient()
  const [remoteApp, _] = await fetchAppAndIdentifiers({...options, reset: false}, developerPlatformClient, false)

  await logMetadataForLoadedContext(remoteApp)

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
    promptAnswer === 'All' ? extensions : [extensions.find((ext) => ext?.uuid === promptAnswer)!]

  const extensionUuids: IdentifiersExtensions = {}
  const importPromises = extensionsToMigrate.map(async (ext) => {
    const directory = await ensureExtensionDirectoryExists({app: options.app, name: ext.title})
    const tomlObject = options.buildTomlObject(ext, extensionRegistrations)
    const path = joinPath(directory, 'shopify.extension.toml')
    await writeFile(path, tomlObject)
    extensionUuids[ext.title] = ext.uuid
    return {extension: ext, directory: joinPath('extensions', basename(directory))}
  })

  const generatedExtensions = await Promise.all(importPromises)
  renderSuccessMessages(generatedExtensions)
  await updateAppIdentifiers({
    app: options.app,
    identifiers: {extensions: extensionUuids, app: remoteApp.apiKey},
    command: 'deploy',
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
