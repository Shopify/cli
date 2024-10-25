import {fetchAppAndIdentifiers, logMetadataForLoadedContext} from './context.js'
import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {getExtensions} from './fetch-extensions.js'
import {AppInterface} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {MAX_EXTENSION_HANDLE_LENGTH} from '../models/extensions/schemas.js'
import {renderSelectPrompt, renderInfo, renderSuccess} from '@shopify/cli-kit/node/ui'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputContent} from '@shopify/cli-kit/node/output'
import {slugify} from '@shopify/cli-kit/common/string'

interface ImportOptions {
  app: AppInterface
  apiKey?: string
  developerPlatformClient?: DeveloperPlatformClient
  extensionTypes: string[]
  buildTomlObject: (ext: ExtensionRegistration, allExtensions: ExtensionRegistration[]) => string
}

export async function importExtensions(options: ImportOptions) {
  const developerPlatformClient =
    options.developerPlatformClient ?? selectDeveloperPlatformClient({configuration: options.app.configuration})
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

  // renderInfo({
  //   headline: ['Hello from importExtensions.'],
  //   body: `${developerPlatformClient} ${remoteApp.apiKey} ${remoteApp.organizationId} ${options.extensionTypes}`,
  // })

  if (extensions.length === 0) {
    renderSuccess({headline: ['No extensions to migrate.']})
    return
  }

  const choices = extensions.map((ext) => {
    return {label: ext.title, value: ext.uuid}
  })
  choices.push({label: 'All', value: 'All'})
  const promptAnswer = await renderSelectPrompt({message: 'Extensions to migrate', choices})

  let extensionsToMigrate =
    promptAnswer === 'All' ? extensions : [extensions.find((ext) => ext?.uuid === promptAnswer)!]

  let flowWebhookMigrationPromptAnswer
  const flowDiscoveryWebhookExt = extensionsToMigrate.find((ext) => ext?.type === 'flow_trigger_discovery_webhook')
  if (flowDiscoveryWebhookExt) {
    const choices = [
      {label: 'Yes', value: true},
      {label: 'No', value: false},
    ]
    flowWebhookMigrationPromptAnswer = await renderSelectPrompt({
      message: 'Migrate the flow_trigger_discovery_webhook extension to flow_trigger_lifecycle_callback?',
      choices,
    })
  }
  if (flowWebhookMigrationPromptAnswer) {
    // call some migration function here
    extensionsToMigrate = extensionsToMigrate.filter((ext) => ext?.uuid !== flowDiscoveryWebhookExt!.uuid)
  }

  renderInfo({
    headline: ['extensionsToMigrate.'],
    body: `${extensionsToMigrate[0]?.id} ${extensionsToMigrate[0]?.uid} ${extensionsToMigrate[0]?.uuid} ${extensionsToMigrate[0]?.title} ${extensionsToMigrate[0]?.type}`,
  })

  // throw new Error('not okay')

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
