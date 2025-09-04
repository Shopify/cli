import {uploadExtensionsBundle, UploadExtensionsBundleOutput} from './deploy/upload.js'

import {ensureDeployContext} from './context.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {allExtensionTypes, filterOutImportedExtensions, importAllExtensions} from './import-extensions.js'
import {getExtensions} from './fetch-extensions.js'
import {AppLinkedInterface} from '../models/app/app.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {Organization, OrganizationApp} from '../models/organization.js'
import {reloadApp} from '../models/app/loader.js'
import {ExtensionRegistration} from '../api/graphql/all_app_extension_registrations.js'
import {getTomls} from '../utilities/app/config/getTomls.js'
import {renderInfo, renderSuccess, renderTasks, renderConfirmationPrompt, isTTY} from '@shopify/cli-kit/node/ui'
import {mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputNewline, outputInfo, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {AbortError, AbortSilentError} from '@shopify/cli-kit/node/error'
import type {AlertCustomSection, Task, TokenItem} from '@shopify/cli-kit/node/ui'

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

  /** If true, skip building any elements of the app that require building */
  skipBuild: boolean
}

interface TasksContext {
  bundlePath?: string
  bundle?: boolean
}

interface ImportExtensionsIfNeededOptions {
  app: AppLinkedInterface
  remoteApp: OrganizationApp
  developerPlatformClient: DeveloperPlatformClient
  force: boolean
}

async function handleSupportedDashboardExtensions(
  options: ImportExtensionsIfNeededOptions & {
    extensions: ExtensionRegistration[]
  },
): Promise<AppLinkedInterface> {
  const {app, remoteApp, developerPlatformClient, force, extensions} = options

  if (force || !isTTY()) {
    return app
  }

  const message = [
    `App includes legacy extensions that will be deprecated soon:\n`,
    extensions.map((ext) => `  - ${ext.title}`).join('\n'),
    '\n\nRun ',
    {command: 'shopify app import-extensions'},
    'to add legacy extensions now?',
  ]
  const shouldImportExtensions = await renderConfirmationPrompt({
    message,
    confirmationMessage: 'Yes, add legacy extensions and deploy',
    cancellationMessage: 'No, skip for now',
  })

  if (shouldImportExtensions) {
    await importAllExtensions({
      app,
      remoteApp,
      developerPlatformClient,
      extensions,
    })
    return reloadApp(app)
  }

  return app
}

async function handleUnsupportedDashboardExtensions(
  options: ImportExtensionsIfNeededOptions & {
    extensions: ExtensionRegistration[]
  },
): Promise<AppLinkedInterface> {
  const {app, remoteApp, developerPlatformClient, force, extensions} = options

  const message = [
    `App can't be deployed until Partner Dashboard managed extensions are added to your version or removed from your app:\n`,
    extensions.map((ext) => `  - ${ext.title}`).join('\n'),
  ]
  const nextSteps = ['\n\nRun ', {command: 'shopify app import-extensions'}, 'to add legacy extensions.']

  if (force || !isTTY()) {
    throw new AbortError(message, nextSteps)
  }

  const question = ['\n\nRun ', {command: 'shopify app import-extensions'}, ' to add legacy extensions now?']
  const shouldImportExtensions = await renderConfirmationPrompt({
    message: [...message, ...question],
    confirmationMessage: 'Yes, add legacy extensions and deploy',
    cancellationMessage: `No, don't add legacy extensions`,
  })

  if (shouldImportExtensions) {
    await importAllExtensions({
      app,
      remoteApp,
      developerPlatformClient,
      extensions,
    })
    return reloadApp(app)
  } else {
    throw new AbortSilentError()
  }
}

export async function importExtensionsIfNeeded(options: ImportExtensionsIfNeededOptions): Promise<AppLinkedInterface> {
  const {app, remoteApp, developerPlatformClient} = options

  const extensions = await getExtensions({
    developerPlatformClient,
    apiKey: remoteApp.apiKey,
    organizationId: remoteApp.organizationId,
    extensionTypes: allExtensionTypes,
    onlyDashboardManaged: true,
  })

  const extensionsNotImportedYet = filterOutImportedExtensions(options.app, extensions)

  if (extensionsNotImportedYet.length === 0) {
    return app
  }

  if (developerPlatformClient.supportsDashboardManagedExtensions) {
    return handleSupportedDashboardExtensions({
      ...options,
      extensions: extensionsNotImportedYet,
    })
  } else {
    return handleUnsupportedDashboardExtensions({
      ...options,
      extensions: extensionsNotImportedYet,
    })
  }
}

export async function deploy(options: DeployOptions) {
  const {remoteApp, developerPlatformClient, noRelease, force} = options

  const app = await importExtensionsIfNeeded({
    app: options.app,
    remoteApp,
    developerPlatformClient,
    force,
  })

  const {identifiers, didMigrateExtensionsToDevDash} = await ensureDeployContext({
    ...options,
    app,
    developerPlatformClient,
  })

  const release = !noRelease
  const apiKey = remoteApp.apiKey

  outputNewline()
  if (release) {
    outputInfo(`Releasing a new app version as part of ${remoteApp.title}`)
  } else {
    outputInfo(`Creating a new app version as part of ${remoteApp.title}`)
  }

  outputNewline()

  let uploadExtensionsBundleResult!: UploadExtensionsBundleOutput

  try {
    const bundle = app.allExtensions.some((ext) => ext.features.includes('bundling'))
    let bundlePath: string | undefined

    if (bundle) {
      bundlePath = joinPath(options.app.directory, '.shopify', `deploy-bundle.${developerPlatformClient.bundleFormat}`)
      await mkdir(dirname(bundlePath))
    }

    const appManifest = await app.manifest(identifiers)

    await bundleAndBuildExtensions({
      app,
      appManifest,
      bundlePath,
      identifiers,
      skipBuild: options.skipBuild,
      isDevDashboardApp: developerPlatformClient.supportsAtomicDeployments,
    })

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
            appManifest,
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

          await updateAppIdentifiers({app, identifiers, command: 'deploy', developerPlatformClient})
        },
      },
    ]

    await renderTasks(tasks)

    await outputCompletionMessage({
      app,
      release,
      uploadExtensionsBundleResult,
      didMigrateExtensionsToDevDash,
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

  return {app}
}

async function outputCompletionMessage({
  app,
  release,
  uploadExtensionsBundleResult,
  didMigrateExtensionsToDevDash,
}: {
  app: AppLinkedInterface
  release: boolean
  uploadExtensionsBundleResult: UploadExtensionsBundleOutput
  didMigrateExtensionsToDevDash: boolean
}) {
  const linkAndMessage = [
    {link: {label: uploadExtensionsBundleResult.versionTag ?? 'version', url: uploadExtensionsBundleResult.location}},
    uploadExtensionsBundleResult.message ? `\n${uploadExtensionsBundleResult.message}` : '',
  ]
  let customSections: AlertCustomSection[] = []
  if (didMigrateExtensionsToDevDash) {
    const tomls = await getTomls(app.directory)
    const tomlsWithoutCurrent = Object.values(tomls).filter((toml) => toml !== tomls[app.configuration.client_id])

    const body: TokenItem = []
    if (tomlsWithoutCurrent.length > 0) {
      body.push(
        '• Map extension IDs to other copies of your app by running',
        {
          command: formatPackageManagerCommand(app.packageManager, 'shopify app deploy'),
        },
        'for: ',
        {
          list: {
            items: tomlsWithoutCurrent,
          },
        },
      )
    }

    body.push("• Commit to source control to ensure your extension IDs aren't regenerated on the next deploy.")
    customSections = [
      {title: 'Next steps', body},
      {
        title: 'Reference',
        body: [
          '• ',
          {
            link: {
              label: 'Migrating from the Partner Dashboard',
              url: 'https://shopify.dev/docs/apps/build/dev-dashboard/migrate-from-partners',
            },
          },
        ],
      },
    ]
  }

  if (release) {
    return uploadExtensionsBundleResult.deployError
      ? renderInfo({
          headline: 'New version created, but not released.',
          body: [...linkAndMessage, `\n\n${uploadExtensionsBundleResult.deployError}`],
          customSections,
        })
      : renderSuccess({
          headline: 'New version released to users.',
          body: linkAndMessage,
          customSections,
        })
  }

  return renderSuccess({
    headline: 'New version created.',
    body: linkAndMessage,
    customSections,
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
