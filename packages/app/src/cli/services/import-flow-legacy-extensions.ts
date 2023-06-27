import {fetchAppAndIdentifiers} from './context.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {AppInterface} from '../models/app/app.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {RenderAlertOptions, renderSelectPrompt, renderSuccess} from '@shopify/cli-kit/node/ui'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {joinPath} from '@shopify/cli-kit/node/path'
import {writeFile} from '@shopify/cli-kit/node/fs'

interface ImportFlowOptions {
  app: AppInterface

  config: Config
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
    type: extension.type,
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
      fields,
    },
  }
}

async function getActiveDashboardExtensions({token, apiKey}: {token: string; apiKey: string}) {
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey})
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations
    .map((ext) => {
      if (ext.type.includes('flow_action')) ext.type = 'flow_action'
      else if (ext.type.includes('flow_trigger')) ext.type = 'flow_trigger'
      return ext
    })
    .filter((ext) => {
      const isFLow = ext.type === 'flow_action' || ext.type === 'flow_trigger'
      const hasActiveVersion = ext.activeVersion && ext.activeVersion.config
      const hasDraftVersion = ext.draftVersion && ext.draftVersion.config
      return isFLow && (hasActiveVersion || hasDraftVersion)
    })
    .map((ext) => ext as DashboardExtension)
}

export async function importFlowExtensions(options: ImportFlowOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, _] = await fetchAppAndIdentifiers({...options, reset: false}, token)
  const activeDashboardExtensions = await getActiveDashboardExtensions({token, apiKey: partnersApp.apiKey})
  const flowExtensions = activeDashboardExtensions.filter(
    (ext) => ext.type === 'flow_action' || ext.type === 'flow_trigger',
  )

  if (flowExtensions.length > 0) {
    const choices = flowExtensions.map((ext) => {
      return {label: ext.title, value: ext.uuid}
    })
    choices.push({label: 'All', value: 'All'})
    const promptAnswer = await renderSelectPrompt({message: 'Extensions to migrate', choices})

    const extensionsToMigrate =
      promptAnswer === 'All' ? flowExtensions : [flowExtensions.find((ext) => ext?.uuid === promptAnswer)!]

    const extensionUuids: IdentifiersExtensions = {}
    const migrationPromises = extensionsToMigrate.map(async (ext) => {
      const directory = await ensureExtensionDirectoryExists({app: options.app, name: ext.title})
      const tomlObject = buildTomlObject(ext)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tomlString = encodeToml(tomlObject as any)
      await writeFile(joinPath(directory, 'shopify.extension.toml'), tomlString)
      extensionUuids[ext.title] = ext.uuid
      return {extension: ext, directory}
    })

    const generatedExtensions = await Promise.all(migrationPromises)
    renderSuccessMessages(generatedExtensions)
    await updateAppIdentifiers({
      app: options.app,
      identifiers: {extensions: extensionUuids, app: partnersApp.apiKey},
      command: 'deploy',
    })
  } else {
    renderSuccess({
      headline: ['No extensions to migrate.'],
    })
  }
}

function renderSuccessMessages(generatedExtensions: {extension: DashboardExtension; directory: string}[]) {
  generatedExtensions.forEach((gen) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage({
      title: gen.extension.title,
      directory: gen.directory,
    })
    renderSuccess(formattedSuccessfulMessage)
  })
}

function formatSuccessfulRunMessage(extension: {title: string; directory: string}): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extension.directory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  return options
}
