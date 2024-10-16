import {uploadThemeExtensions, uploadExtensionsBundle, UploadExtensionsBundleOutput} from './deploy/upload.js'

import {ensureDeployContext} from './context.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import {renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputNewline, outputInfo, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import type {Task} from '@shopify/cli-kit/node/ui'

export interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppLinkedInterface

  /** The remote app to be deployed */
  remoteApp: OrganizationApp

  /** The organization of the remote app */
  organization: Organization

  /** The API client to send authenticated requests  */
  developerPlatformClient: DeveloperPlatformClient

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** If true, deploy app without releasing it to the users */
  noRelease: boolean

  /** App version message */
  message?: string

  /** App version identifier */
  version?: string

  /** The git reference url of the app version */
  commitReference?: string
}

interface TasksContext {
  bundlePath?: string
  bundle?: boolean
}

export async function deploy(options: DeployOptions) {
  const {app, remoteApp, developerPlatformClient, noRelease} = options

  const identifiers = await ensureDeployContext({...options, developerPlatformClient})
  const release = !noRelease
  const apiKey = remoteApp.apiKey

  outputNewline()
  if (release) {
    outputInfo(`Releasing a new app version as part of ${remoteApp.title}`)
  } else {
    outputInfo(`Creating a new app version as part of ${remoteApp.title}`)
  }

  outputNewline()

  let uploadExtensionsBundleResult: UploadExtensionsBundleOutput

  await inTemporaryDirectory(async (tmpDir) => {
    try {
      const bundle = app.allExtensions.some((ext) => ext.features.includes('bundling'))
      let bundlePath: string | undefined

      if (bundle) {
        bundlePath = joinPath(tmpDir, `bundle.zip`)
        await mkdir(dirname(bundlePath))
      }
      await bundleAndBuildExtensions({app, bundlePath, identifiers})

      let uploadTaskTitle

      if (release) {
        uploadTaskTitle = 'Releasing an app version'
      } else {
        uploadTaskTitle = 'Creating an app version'
      }

      const tasks: Task<TasksContext>[] = [
        {
          title: 'Running validation',
          task: async () => {
            await app.preDeployValidation()
          },
        },
        {
          title: uploadTaskTitle,
          task: async () => {
            const appModules = await Promise.all(
              app.allExtensions.flatMap((ext) =>
                ext.bundleConfig({identifiers, developerPlatformClient, apiKey, appConfiguration: app.configuration}),
              ),
            )

            uploadExtensionsBundleResult = await uploadExtensionsBundle({
              appId: remoteApp.id,
              apiKey,
              name: app.name,
              organizationId: remoteApp.organizationId,
              bundlePath,
              appModules: getArrayRejectingUndefined(appModules),
              release,
              developerPlatformClient,
              extensionIds: identifiers.extensionIds,
              message: options.message,
              version: options.version,
              commitReference: options.commitReference,
            })

            if (!useThemebundling()) {
              const themeExtensions = app.allExtensions.filter((ext) => ext.isThemeExtension)
              await uploadThemeExtensions(themeExtensions, {apiKey, identifiers, developerPlatformClient})
            }

            await updateAppIdentifiers({app, identifiers, command: 'deploy', developerPlatformClient})
          },
        },
      ]

      await renderTasks(tasks)

      await outputCompletionMessage({
        app,
        release,
        uploadExtensionsBundleResult,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      /**
       * If deployment fails when uploading we want the identifiers to be persisted
       * for the next run.
       */
      await updateAppIdentifiers({app, identifiers, command: 'deploy', developerPlatformClient})
      throw error
    }
  })

  return {app}
}

async function outputCompletionMessage({
  app,
  release,
  uploadExtensionsBundleResult,
}: {
  app: AppLinkedInterface
  release: boolean
  uploadExtensionsBundleResult: UploadExtensionsBundleOutput
}) {
  const linkAndMessage = [
    {link: {label: uploadExtensionsBundleResult.versionTag ?? 'version', url: uploadExtensionsBundleResult.location}},
    uploadExtensionsBundleResult.message ? `\n${uploadExtensionsBundleResult.message}` : '',
  ]
  if (release) {
    return uploadExtensionsBundleResult.deployError
      ? renderInfo({
          headline: 'New version created, but not released.',
          body: [...linkAndMessage, `\n\n${uploadExtensionsBundleResult.deployError}`],
        })
      : renderSuccess({
          headline: 'New version released to users.',
          body: linkAndMessage,
        })
  }

  return renderSuccess({
    headline: 'New version created.',
    body: linkAndMessage,
    nextSteps: [
      [
        'Run',
        {
          command: formatPackageManagerCommand(
            app.packageManager,
            'shopify app release',
            `--version=${uploadExtensionsBundleResult.versionTag}`,
          ),
        },
        'to release this version to users.',
      ],
    ],
  })
}
