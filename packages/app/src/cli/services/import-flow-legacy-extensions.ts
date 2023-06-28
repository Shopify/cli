import {fetchAppAndIdentifiers} from './context.js'
import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {buildTomlObject} from './import-flow/extension-to-toml.js'
import {getActiveDashboardExtensions} from './import-flow/fetch.js'
import {AppInterface} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {basename, joinPath} from '@shopify/cli-kit/node/path'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {outputContent, outputToken} from '@shopify/cli-kit/node/output'

interface ImportFlowOptions {
  app: AppInterface
  config: Config
  apiKey?: string
}

export async function importFlowExtensions(options: ImportFlowOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, _] = await fetchAppAndIdentifiers({...options, reset: false}, token)
  const flowExtensions = await getActiveDashboardExtensions({token, apiKey: partnersApp.apiKey})

  if (flowExtensions.length === 0) {
    renderSuccess({headline: ['No extensions to migrate.']})
    return
  }

  const choices = flowExtensions.map((ext) => {
    return {label: ext.title, value: ext.uuid}
  })
  choices.push({label: 'All', value: 'All'})
  const promptAnswer = await renderSelectPrompt({message: 'Extensions to migrate', choices})

  const extensionsToMigrate =
    promptAnswer === 'All' ? flowExtensions : [flowExtensions.find((ext) => ext?.uuid === promptAnswer)!]

  const extensionUuids: IdentifiersExtensions = {}
  const importPromises = extensionsToMigrate.map(async (ext) => {
    const directory = await ensureExtensionDirectoryExists({app: options.app, name: ext.title})
    const tomlObject = buildTomlObject(ext)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tomlString = encodeToml(tomlObject as any)
    await writeFile(joinPath(directory, 'shopify.extension.toml'), tomlString)
    extensionUuids[ext.title] = ext.uuid
    return {extension: ext, directory: joinPath('extensions', basename(directory))}
  })

  const generatedExtensions = await Promise.all(importPromises)
  renderSuccessMessages(generatedExtensions)
  await updateAppIdentifiers({
    app: options.app,
    identifiers: {extensions: extensionUuids, app: partnersApp.apiKey},
    command: 'deploy',
  })
}

function renderSuccessMessages(generatedExtensions: {extension: ExtensionRegistration; directory: string}[]) {
  renderSuccess({
    headline: ['Imported the following extensions from the dashboard:'],
    body: generatedExtensions
      .map((gen) => {
        return outputContent`• "${outputToken.italic(gen.extension.title)}" at: ${gen.directory}`.value
      })
      .join('\n'),
  })
}
