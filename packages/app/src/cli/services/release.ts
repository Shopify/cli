import {ensureReleaseContext} from './context.js'
import {
  configExtensionsIdentifiersBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './context/breakdown-extensions.js'
import {AppInterface} from '../models/app/app.js'
import {AppRelease, AppReleaseSchema, AppReleaseVariables} from '../api/graphql/app_release.js'
import {deployOrReleaseConfirmationPrompt} from '../prompts/deploy-release.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {renderError, renderSuccess, renderTasks, TokenItem} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface ReleaseOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** App version tag */
  version: string
}

export async function release(options: ReleaseOptions) {
  const {token, app, partnersApp} = await ensureReleaseContext(options)

  const {extensionIdentifiersBreakdown, versionDetails} = await extensionsIdentifiersReleaseBreakdown(
    token,
    partnersApp.apiKey,
    options.version,
  )
  const configExtensionIdentifiersBreakdown = await configExtensionsIdentifiersBreakdown({
    token,
    apiKey: partnersApp.apiKey,
    localApp: app,
    versionAppModules: versionDetails.appModuleVersions,
    release: true,
  })
  const confirmed = await deployOrReleaseConfirmationPrompt({
    configExtensionIdentifiersBreakdown,
    extensionIdentifiersBreakdown,
    appTitle: partnersApp.title,
    release: true,
    force: options.force,
  })
  if (!confirmed) throw new AbortSilentError()
  interface Context {
    appRelease: AppReleaseSchema
  }

  const variables: AppReleaseVariables = {
    apiKey: partnersApp.apiKey,
    appVersionId: versionDetails.id,
  }

  const tasks = [
    {
      title: 'Releasing version',
      task: async (context: Context) => {
        context.appRelease = await partnersRequest(AppRelease, token, variables)
      },
    },
  ]

  const {
    appRelease: {appRelease: release},
  } = await renderTasks<Context>(tasks)

  const linkAndMessage: TokenItem = [
    {link: {label: versionDetails.versionTag, url: versionDetails.location}},
    versionDetails.message ? `\n${versionDetails.message}` : '',
  ]

  if (release.userErrors?.length > 0) {
    renderError({
      headline: "Version couldn't be released.",
      body: [
        ...linkAndMessage,
        `${linkAndMessage.length > 0 ? '\n\n' : ''}${release.userErrors.map((error) => error.message).join(', ')}`,
      ],
    })
  } else {
    renderSuccess({
      headline: 'Version released to users.',
      body: linkAndMessage,
    })
  }
}
