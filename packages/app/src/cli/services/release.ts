import {
  configExtensionsIdentifiersReleaseBreakdown,
  extensionsIdentifiersReleaseBreakdown,
} from './context/breakdown-extensions.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {AppReleaseSchema} from '../api/graphql/app_release.js'
import {deployOrReleaseConfirmationPrompt} from '../prompts/deploy-release.js'
import {OrganizationApp} from '../models/organization.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import type {ReleaseResult} from './release/types.js'

interface ReleaseOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be released */
  remoteApp: OrganizationApp

  /** The developer platform client */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, proceed with deploy without asking for confirmation (equivalent to allowUpdates && allowDeletes) */
  force: boolean

  /** If true, allow adding and updating extensions and configuration without user confirmation */
  allowUpdates?: boolean

  /** If true, allow removing extensions and configuration without user confirmation */
  allowDeletes?: boolean

  /** App version tag */
  version: string
}

export async function release(options: ReleaseOptions): Promise<ReleaseResult> {
  const {developerPlatformClient, app, remoteApp} = options

  const {extensionIdentifiersBreakdown, versionDetails} = await extensionsIdentifiersReleaseBreakdown(
    developerPlatformClient,
    remoteApp,
    options.version,
  )

  const configExtensionIdentifiersBreakdown = configExtensionsIdentifiersReleaseBreakdown({
    localApp: app,
    versionAppModules: versionDetails.appModuleVersions,
    activeAppVersion: await developerPlatformClient.activeAppVersion(remoteApp),
  })
  const confirmed = await deployOrReleaseConfirmationPrompt({
    configExtensionIdentifiersBreakdown,
    extensionIdentifiersBreakdown,
    appTitle: remoteApp.title,
    release: true,
    allowUpdates: options.force || options.allowUpdates,
    allowDeletes: options.force || options.allowDeletes,
  })

  if (!confirmed) return {status: 'cancelled'}
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

  if (release.userErrors && release.userErrors.length > 0) {
    return {status: 'failed', version: versionDetails, userErrors: release.userErrors}
  }
  return {status: 'success', version: versionDetails}
}
