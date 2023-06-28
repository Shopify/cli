import {fetchAppAndIdentifiers} from './context.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {AppInterface} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
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

interface DashboardExtension {
  id: string
  uuid: string
  title: string
  type: string
  activeVersion: {
    id: string
    uuid: string
    config: string
  }
  draftVersion?: {
    config: string
  }
}

interface FlowConfig {
  title: string
  description: string
  url: string
  fields?: {
    id: string
    name: string
    label: string
    description?: string
    required: boolean
    uiType: string
  }[]
  custom_configuration_page_url?: string
  custom_configuration_page_preview_url?: string
  validation_url?: string
}

/**
 * Given a flow extension config file, convert it to toml
 * Works for both trigger and action because trigger config is a subset of action config
 */
function buildTomlObject(extension: DashboardExtension) {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: FlowConfig = JSON.parse(versionConfig)

  // Remote config uses uiType, local config uses ui_type
  const fields = config.fields?.map((field) => {
    return {
      key: field.name,
      name: field.label,
      description: field.description,
      required: field.required,
      type: field.uiType,
    }
  })

  return {
    name: extension.title,
    type: extension.type.replace('_definition', ''),
    description: config.description,
    extensions: [
      {
        title: config.title,
        description: config.description,
        runtime_url: config.url,
        config_page_url: config.custom_configuration_page_url,
        config_page_preview_url: config.custom_configuration_page_preview_url,
        validation_url: config.validation_url,
      },
    ],
    settings: {
      fields: fields ?? undefined,
    },
  }
}

async function getActiveDashboardExtensions({token, apiKey}: {token: string; apiKey: string}) {
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey})
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations
    .filter((ext) => {
      const isFLow = ext.type === 'flow_action_definition' || ext.type === 'flow_trigger_definition'
      const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
      const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
      return isFLow && (hasActiveVersion || hasDraftVersion)
    })
    .map((ext) => ext as DashboardExtension)
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

function renderSuccessMessages(generatedExtensions: {extension: DashboardExtension; directory: string}[]) {
  renderSuccess({
    headline: ['Imported the following extensions from the dashboard:'],
    body: generatedExtensions
      .map((gen) => {
        return outputContent`• "${outputToken.italic(gen.extension.title)}" at: ${gen.directory}`.value
      })
      .join('\n'),
  })
}
