import {ensureReleaseContext} from './context.js'
import {
  configExtensionsIdentifiersBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './context/breakdown-extensions.js'
import {AppInterface} from '../models/app/app.js'
import {AppReleaseSchema, AppReleaseVariables} from '../api/graphql/app_release.js'
import {deployOrReleaseConfirmationPrompt} from '../prompts/deploy-release.js'
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
  const {developerPlatformClient, app, remoteApp} = await ensureReleaseContext(options)

  const {extensionIdentifiersBreakdown, versionDetails} = await extensionsIdentifiersReleaseBreakdown(
    developerPlatformClient,
    remoteApp,
    options.version,
  )
  const configExtensionIdentifiersBreakdown = await configExtensionsIdentifiersBreakdown({
    developerPlatformClient,
    apiKey: remoteApp.apiKey,
    localApp: app,
    remoteApp,
    versionAppModules: versionDetails.appModuleVersions.map((appModuleVersion) => ({
      ...appModuleVersion,
      ...(appModuleVersion.config ? {config: JSON.parse(appModuleVersion.config)} : {}),
    })),
    release: true,
  })
  const confirmed = await deployOrReleaseConfirmationPrompt({
    configExtensionIdentifiersBreakdown,
    extensionIdentifiersBreakdown,
    appTitle: remoteApp.title,
    release: true,
    force: options.force,
  })
  if (!confirmed) throw new AbortSilentError()
  interface Context {
    appRelease: AppReleaseSchema
  }

  const variables: AppReleaseVariables = {
    apiKey: remoteApp.apiKey,
    appVersionId: versionDetails.id,
  }

  const tasks = [
    {
      title: 'Releasing version',
      task: async (context: Context) => {
        context.appRelease = await developerPlatformClient.release(variables)
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
