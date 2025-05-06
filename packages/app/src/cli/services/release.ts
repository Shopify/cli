import {
  configExtensionsIdentifiersBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './context/breakdown-extensions.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {AppReleaseSchema} from '../api/graphql/app_release.js'
import {deployOrReleaseConfirmationPrompt} from '../prompts/deploy-release.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {renderError, renderSuccess, renderTasks, TokenItem} from '@shopify/cli-kit/node/ui'
import {AbortSilentError} from '@shopify/cli-kit/node/error'

interface ReleaseOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be released */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** App version tag */
  version: string
}

export async function release(options: ReleaseOptions) {
  const {developerPlatformClient, app, remoteApp} = options

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

  const tasks = [
    {
      title: 'Releasing version',
      task: async (context: Context) => {
        context.appRelease = await developerPlatformClient.release({
          app: remoteApp,
          version: {
            versionId: versionDetails.uuid,
            appVersionId: versionDetails.id,
          },
        })
      },
    },
  ]

  const {
    appRelease: {appRelease: release},
  } = await renderTasks<Context>(tasks)

  const linkAndMessage: TokenItem = [
    {link: {label: versionDetails.versionTag ?? undefined, url: versionDetails.location}},
    versionDetails.message ? `\n${versionDetails.message}` : '',
  ]

  if (release.userErrors && release.userErrors.length > 0) {
    const errorMessages = release.userErrors?.map((error) => error.message).join(', ')
    renderError({
      headline: "Version couldn't be released.",
      body: [...linkAndMessage, `${linkAndMessage.length > 0 ? '\n\n' : ''}${errorMessages}`],
    })
  } else {
    renderSuccess({
      headline: 'Version released to users.',
      body: linkAndMessage,
    })
  }
}
