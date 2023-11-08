/* eslint-disable require-atomic-updates */
import {uploadThemeExtensions, uploadExtensionsBundle, UploadExtensionsBundleOutput} from './deploy/upload.js'

import {ensureDeployContext} from './context.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {AppInterface, type NormalizedWebhookSubscriptions} from '../models/app/app.js'
import {updateAppIdentifiers} from '../models/app/identifiers.js'
import {fakedWebhookSubscriptionsMutation, filterFalsey} from '../utilities/app/config/webhooks.js'
import {renderInfo, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputNewline, outputInfo, formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
import {getArrayRejectingUndefined} from '@shopify/cli-kit/common/array'
import {Config} from '@oclif/core'
import {pickBy} from '@shopify/cli-kit/common/object'
import type {Task} from '@shopify/cli-kit/node/ui'

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

  /** The git reference url of the app version */
  commitReference?: string

  /** The config from the Oclif command */
  commandConfig: Config
}

interface TasksContext {
  bundlePath?: string
  bundle?: boolean
}

export async function deploy(options: DeployOptions) {
  // eslint-disable-next-line prefer-const
  let {app, identifiers, partnersApp, token, release} = await ensureDeployContext(options)
  const apiKey = identifiers.app

  outputNewline()
  if (release) {
    outputInfo(`Releasing a new app version as part of ${partnersApp.title}`)
  } else {
    outputInfo(`Creating a new app version as part of ${partnersApp.title}`)
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
              options.app.allExtensions.flatMap((ext) => ext.bundleConfig({identifiers, token, apiKey})),
            )

            uploadExtensionsBundleResult = await uploadExtensionsBundle({
              apiKey,
              bundlePath,
              appModules: getArrayRejectingUndefined(appModules),
              release,
              token,
              extensionIds: identifiers.extensionIds,
              message: options.message,
              version: options.version,
              commitReference: options.commitReference,
            })

            if (!useThemebundling()) {
              const themeExtensions = options.app.allExtensions.filter((ext) => ext.isThemeExtension)
              await uploadThemeExtensions(themeExtensions, {apiKey, identifiers, token})
            }

            app = await updateAppIdentifiers({app, identifiers, command: 'deploy'})
          },
        },
      ]

      if (partnersApp.betas?.declarativeWebhooks) {
        tasks.push({
          title: 'Releasing webhooks',
          task: async () => {
            if (!('webhooks' in app.configuration)) return

            // normalize webhook config with the top level config
            const webhookSubscriptions: NormalizedWebhookSubscriptions = []
            const {topics, subscriptions, ...webhookConfig} = app.configuration.webhooks
            const topLevelDestination = pickBy(
              webhookConfig,
              (value, key) =>
                ['subscription_endpoint_url', 'arn', 'pubsub_project', 'pubsub_topic'].includes(key) && value,
            )

            if (Object.keys(topLevelDestination).length && topics?.length) {
              for (const topic of topics) {
                webhookSubscriptions.push({
                  topic,
                  ...topLevelDestination,
                })
              }
            }

            if (subscriptions?.length) {
              for (const {path, ...subscription} of subscriptions) {
                const hasLocalDestination = Boolean(
                  filterFalsey([
                    subscription.subscription_endpoint_url,
                    subscription.arn,
                    subscription.pubsub_project && subscription.pubsub_topic,
                  ]).length,
                )

                // we can assume this is valid from earlier validation, and local config will overwrite top level if there is any
                const subscriptionConfig = {
                  ...(hasLocalDestination ? {} : topLevelDestination),
                  ...subscription,
                }

                if (path && subscriptionConfig.subscription_endpoint_url) {
                  subscriptionConfig.subscription_endpoint_url = `${subscriptionConfig.subscription_endpoint_url}${path}`
                }

                webhookSubscriptions.push(subscriptionConfig)
              }
            }

            // eslint-disable-next-line no-warning-comments
            // TODO - make request with webhookSubscriptions
            fakedWebhookSubscriptionsMutation(webhookSubscriptions)
          },
        })
      }

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
      await updateAppIdentifiers({app, identifiers, command: 'deploy'})
      throw error
    }
  })
}

async function outputCompletionMessage({
  app,
  release,
  uploadExtensionsBundleResult,
}: {
  app: AppInterface
  release: boolean
  uploadExtensionsBundleResult: UploadExtensionsBundleOutput
}) {
  const linkAndMessage = [
    {link: {label: uploadExtensionsBundleResult.versionTag, url: uploadExtensionsBundleResult.location}},
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
