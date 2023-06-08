/* eslint-disable require-atomic-updates */
import {
  uploadFunctionExtensions,
  uploadThemeExtensions,
  uploadExtensionsBundle,
  uploadWasmBlob,
  functionConfiguration,
  UploadExtensionsBundleOutput,
} from './deploy/upload.js'

import {ensureDeployContext} from './context.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {DeploymentMode} from './deploy/mode.js'
import {AppInterface} from '../models/app/app.js'
import {Identifiers, updateAppIdentifiers} from '../models/app/identifiers.js'
import {Extension, FunctionExtension} from '../models/app/extensions.js'
import {OrganizationApp} from '../models/organization.js'
import {validateExtensions} from '../validators/extensions.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../api/graphql/all_app_extension_registrations.js'
import {renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputNewline, outputInfo, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import type {AlertCustomSection, Task} from '@shopify/cli-kit/node/ui'

interface DeployOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

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
}

interface TasksContext {
  bundlePath?: string
  bundle?: boolean
}

export async function deploy(options: DeployOptions) {
  // eslint-disable-next-line prefer-const
  let {app, identifiers, partnersApp, token, deploymentMode} = await ensureDeployContext(options)
  const apiKey = identifiers.app
  const unifiedDeployment = deploymentMode !== 'legacy'

  if (!options.app.hasExtensions() && !unifiedDeployment) {
    renderInfo({headline: 'No extensions to deploy to Shopify Partners yet.'})
    return
  }

  outputNewline()
  switch (deploymentMode) {
    case 'legacy':
      outputInfo(`Deploying your work to Shopify Partners. It will be part of ${partnersApp.title}`)
      break
    case 'unified':
      outputInfo(`Releasing a new app version as part of ${partnersApp.title}`)
      break
    case 'unified-skip-release':
      outputInfo(`Creating a new app version as part of ${partnersApp.title}`)
      break
  }

  outputNewline()

  const appModules = await Promise.all(
    options.app.extensions.ui.map(async (extension) => {
      return {
        uuid: identifiers.extensions[extension.localIdentifier]!,
        config: JSON.stringify(await extension.deployConfig()),
        context: '',
      }
    }),
  )

  if (useThemebundling()) {
    const themeExtensions = await Promise.all(
      options.app.extensions.theme.map(async (extension) => {
        return {
          uuid: identifiers.extensions[extension.localIdentifier]!,
          config: '{"theme_extension": {"files": {}}}',
          context: '',
        }
      }),
    )
    appModules.push(...themeExtensions)
  }

  let registrations: AllAppExtensionRegistrationsQuerySchema
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

      const uploadTaskTitle = (() => {
        switch (deploymentMode) {
          case 'legacy':
            return 'Pushing your code to Shopify'
          case 'unified':
            return 'Releasing an app version'
          case 'unified-skip-release':
            return 'Creating an app version'
        }
      })()

      const tasks: Task<TasksContext>[] = [
        {
          title: 'Running validation',
          task: async () => {
            await validateExtensions(app)
          },
        },
        {
          title: uploadTaskTitle,
          task: async () => {
            if (unifiedDeployment) {
              const functionExtensions = await Promise.all(
                options.app.extensions.function.map(async (extension) => {
                  const {moduleId} = await uploadWasmBlob(extension, identifiers.app, token)
                  return {
                    uuid: identifiers.extensions[extension.localIdentifier]!,
                    config: JSON.stringify(await functionConfiguration(extension, moduleId, apiKey)),
                    context: '',
                  }
                }),
              )
              appModules.push(...functionExtensions)
            }

            if (bundle || unifiedDeployment) {
              uploadExtensionsBundleResult = await uploadExtensionsBundle({
                apiKey,
                bundlePath,
                appModules: getArrayRejectingUndefined(appModules),
                deploymentMode,
                token,
                extensionIds: identifiers.extensionIds,
                message: options.message,
                version: options.version,
              })
            }

            if (!useThemebundling()) {
              const themeExtensions = options.app.allExtensions.filter((ext) => ext.isThemeExtension)
              await uploadThemeExtensions(themeExtensions, {apiKey, identifiers, token})
            }

            if (!unifiedDeployment) {
              const functions = options.app.allExtensions.filter((ext) => ext.isFunctionExtension)
              identifiers = await uploadFunctionExtensions(functions as unknown as FunctionExtension[], {
                identifiers,
                token,
              })
            }

            app = await updateAppIdentifiers({app, identifiers, command: 'deploy'})
            registrations = await fetchAppExtensionRegistrations({token, apiKey: identifiers.app})
          },
        },
      ]

      await renderTasks(tasks)

      await outputCompletionMessage({
        app,
        partnersApp,
        partnersOrganizationId: partnersApp.organizationId,
        identifiers,
        registrations,
        deploymentMode,
        uploadExtensionsBundleResult,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      /**
       * If deployment fails when uploading we want the identifiers to be persisted
       * for the next run.
       */
      await updateAppIdentifiers({app, identifiers, command: 'deploy'})
      throw error
    }
  })
}

async function outputCompletionMessage({
  app,
  partnersApp,
  partnersOrganizationId,
  identifiers,
  registrations,
  deploymentMode,
  uploadExtensionsBundleResult,
}: {
  app: AppInterface
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  partnersOrganizationId: string
  identifiers: Identifiers
  registrations: AllAppExtensionRegistrationsQuerySchema
  deploymentMode: DeploymentMode
  uploadExtensionsBundleResult?: UploadExtensionsBundleOutput
}) {
  if (deploymentMode !== 'legacy') {
    return outputUnifiedCompletionMessage(deploymentMode, uploadExtensionsBundleResult!, app)
  }

  let headline: string

  const validationErrors = uploadExtensionsBundleResult?.validationErrors ?? []
  if (validationErrors.length > 0) {
    headline = 'Deployed to Shopify, but fixes are needed.'
  } else {
    headline = 'Deployed to Shopify!'
  }

  const outputDeployedButNotLiveMessage = (extension: Extension) => {
    const result = [`${extension.localIdentifier} is deployed to Shopify but not yet live`]
    const uuid = identifiers.extensions[extension.localIdentifier]
    const validationError = validationErrors.find((error) => error.uuid === uuid)

    if (validationError) {
      result.push('\n- Validation errors found in your extension toml file')
      validationError.errors.forEach((err) => {
        result.push(`\n  └ ${err.message}`)
      })
    }

    return result
  }

  const outputNextStep = async (extension: Extension) => {
    const extensionId =
      registrations.app.extensionRegistrations.find((registration) => {
        return registration.uuid === identifiers.extensions[extension.localIdentifier]
      })?.id ?? ''
    return [
      'Publish',
      {
        link: {
          url: await extension.publishURL({orgId: partnersOrganizationId, appId: partnersApp.id, extensionId}),
          label: extension.localIdentifier,
        },
      },
    ]
  }

  const customSections: AlertCustomSection[] = [
    {
      title: 'Summary',
      body: {
        list: {
          items: app.allExtensions.map(outputDeployedButNotLiveMessage),
        },
      },
    },
  ]

  const nonFunctionExtensions = app.allExtensions.filter((ext) => !ext.isFunctionExtension)
  if (nonFunctionExtensions.length > 0) {
    customSections.push({
      title: 'Next steps',
      body: {
        list: {
          items: await Promise.all(nonFunctionExtensions.map(outputNextStep)),
        },
      },
    })
  }

  renderSuccess({
    headline,
    customSections,
  })
}

async function outputUnifiedCompletionMessage(
  deploymentMode: DeploymentMode,
  uploadExtensionsBundleResult: UploadExtensionsBundleOutput,
  app: AppInterface,
) {
  if (deploymentMode === 'unified') {
    return uploadExtensionsBundleResult?.released
      ? renderSuccess({
          headline: 'New version released to users.',
          body: [{link: {label: uploadExtensionsBundleResult?.versionTag, url: uploadExtensionsBundleResult.location}}],
          nextSteps: [
            [
              'Run',
              {command: formatPackageManagerCommand(app.packageManager, 'versions list')},
              'to see rollout progress.',
            ],
          ],
        })
      : renderInfo({
          headline: 'New version created, but not released.',
          body: [
            {link: {label: uploadExtensionsBundleResult?.versionTag, url: uploadExtensionsBundleResult.location}},
            `\n\nThis app version needs to pass Shopify review before it can be released.`,
          ],
          nextSteps: [['Submnit this version for review fron the Partners Dashboard.']],
        })
  }

  return renderSuccess({
    headline: 'New version created.',
    body: [
      {link: {label: uploadExtensionsBundleResult?.versionTag, url: uploadExtensionsBundleResult.location}},
      `\n${uploadExtensionsBundleResult?.message}`,
    ],
    nextSteps: [
      [
        'Run',
        {
          command: formatPackageManagerCommand(
            app.packageManager,
            'release',
            `--version=${uploadExtensionsBundleResult.versionTag}`,
          ),
        },
        'to release this version to users.',
      ],
    ],
  })
}
