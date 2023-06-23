import {fetchAppAndIdentifiers} from './context.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {ensureExtensionDirectoryExists} from './extensions/common.js'
import {AppInterface} from '../models/app/app.js'
import {importExtensionsPrompt} from '../prompts/import-flow-legacy-extensions.js'
import {updateAppIdentifiers, IdentifiersExtensions} from '../models/app/identifiers.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {writeFileSync} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

interface MigrateOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  config: Config

  reset: boolean
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

interface FlowActionConfig {
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

function buildActionTomlObject(extension: DashboardExtension) {
  const versionConfig = extension.activeVersion.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: FlowActionConfig = JSON.parse(versionConfig)
  const fields = config.fields?.map((field) => {
    return {...field, ui_type: field.uiType}
  })
  return {
    name: extension.title,
    type: 'flow_action',
    task: {
      title: config.title,
      description: config.description,
      url: config.url,
      custom_configuration_page_url: config.custom_configuration_page_url,
      custom_configuration_page_preview_url: config.custom_configuration_page_preview_url,
      validation_url: config.validation_url,
      ...(fields && fields.length > 0 && {fields}),
    },
  }
}

async function getActiveDashboardExtensions({token, apiKey}: {token: string; apiKey: string}) {
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey})
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations
    .filter((extension) => {
      if ((extension.activeVersion && extension.activeVersion.config) || extension.draftVersion?.config) {
        return extension
      }
    })
    .map((ext) => ext as DashboardExtension)
}

export async function importFlowExtensions(options: MigrateOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, _] = await fetchAppAndIdentifiers(options, token)
  const activeDashboardExtensions = await getActiveDashboardExtensions({token, apiKey: partnersApp.apiKey})

  const generatedExtensions: {title: string; directory: string}[] = []

  if (activeDashboardExtensions.length > 0) {
    const promptOptions = await buildPromptOptions(activeDashboardExtensions)
    const promptAnswer = await importExtensionsPrompt(promptOptions)

    const extensionsToMigrate =
      promptAnswer === 'All'
        ? activeDashboardExtensions
        : [activeDashboardExtensions.find((ext) => ext?.title === promptAnswer)]

    const extensionUuids: IdentifiersExtensions = {}
    for (const extension of extensionsToMigrate) {
      if (extension === undefined) continue
      // eslint-disable-next-line no-await-in-loop
      const directory = await ensureExtensionDirectoryExists({app: options.app, name: extension.title})
      const tomlObject = buildActionTomlObject(extension)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tomlString = encodeToml(tomlObject as any)
      writeFileSync(joinPath(directory, 'shopify.extension.toml'), tomlString)
      generatedExtensions.push({title: extension.title, directory})
      extensionUuids[extension.title] = extension.uuid
    }
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

async function buildPromptOptions(extensions: (DashboardExtension | undefined)[]): Promise<string[]> {
  const names = extensions.map((ext) => ext?.title).filter((name) => name !== undefined) as string[]
  names.push('All')

  return names
}

function renderSuccessMessages(generatedExtensions: {title: string; directory: string}[]) {
  generatedExtensions.forEach((extension) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage(extension)
    renderSuccess(formattedSuccessfulMessage)
  })
}

function formatSuccessfulRunMessage(extension: {title: string; directory: string}): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extension.directory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  // if (extension.helpURL) {
  //   options.reference!.push(['For more details, see the', {link: {label: 'docs', url: extension.helpURL}}])
  // }

  return options
}
