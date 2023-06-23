import {fetchAppAndIdentifiers} from './context.js'
import {GeneratedExtension} from './generate/extension.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import generate from './generate.js'
import {AppInterface} from '../models/app/app.js'
import {importExtensionsPrompt} from '../prompts/import-flow-legacy-extensions.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {RenderAlertOptions, renderSuccess} from '@shopify/cli-kit/node/ui'

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
}

async function getActiveDashboardExtensions({token, apiKey}: {token: string; apiKey: string}) {
  const initialRemoteExtensions = await fetchAppExtensionRegistrations({token, apiKey})
  console.log(JSON.stringify(initialRemoteExtensions, null, 2))
  const {dashboardManagedExtensionRegistrations} = initialRemoteExtensions.app
  return dashboardManagedExtensionRegistrations
    .filter((extension) => {
      if (extension && extension.activeVersion && extension.activeVersion.config) {
        return extension
      }
    })
    .map((ext) => ext as DashboardExtension)
}

export async function importFlowExtensions(options: MigrateOptions) {
  const token = await ensureAuthenticatedPartners()
  const [partnersApp, _] = await fetchAppAndIdentifiers(options, token)
  console.log(JSON.stringify(partnersApp, null, 2))
  const activeDashboardExtensions = await getActiveDashboardExtensions({token, apiKey: partnersApp.apiKey})

  const generatedExtensions = [] as GeneratedExtension[]

  if (activeDashboardExtensions.length > 0) {
    const promptOptions = await buildPromptOptions(activeDashboardExtensions)
    const promptAnswer = await importExtensionsPrompt(promptOptions)

    const extensionsToMigrate =
      promptAnswer === 'All'
        ? activeDashboardExtensions
        : [activeDashboardExtensions.find((ext) => ext?.title === promptAnswer)]

    console.log(extensionsToMigrate)

    for (const extension of extensionsToMigrate) {
      if (extension === undefined) continue
      // eslint-disable-next-line no-await-in-loop
      const generated = await generate({
        directory: options.app.directory,
        reset: false,
        config: options.config,
        apiKey: partnersApp.apiKey,
        type: extension.type,
        name: extension.title,
      })
      generatedExtensions.push(...generated)
    }
    renderSuccessMessages(generatedExtensions)
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

function renderSuccessMessages(generatedExtensions: GeneratedExtension[]) {
  generatedExtensions.forEach((extension) => {
    const formattedSuccessfulMessage = formatSuccessfulRunMessage(extension)
    renderSuccess(formattedSuccessfulMessage)
  })
}

function formatSuccessfulRunMessage(extension: GeneratedExtension): RenderAlertOptions {
  const options: RenderAlertOptions = {
    headline: ['Your extension was created in', {filePath: extension.directory}, {char: '.'}],
    nextSteps: [],
    reference: [],
  }

  if (extension.helpURL) {
    options.reference!.push(['For more details, see the', {link: {label: 'docs', url: extension.helpURL}}])
  }

  return options
}
