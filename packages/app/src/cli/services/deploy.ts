/* eslint-disable require-atomic-updates */
import {
  UploadExtensionValidationError,
  uploadFunctionExtensions,
  uploadThemeExtensions,
  uploadExtensionsBundle,
} from './deploy/upload.js'

import {ensureDeployContext} from './context.js'
import {bundleAndBuildExtensions} from './deploy/bundle.js'
import {fetchAppExtensionRegistrations} from './dev/fetch.js'
import {AppInterface} from '../models/app/app.js'
import {Identifiers, updateAppIdentifiers} from '../models/app/identifiers.js'
import {Extension} from '../models/app/extensions.js'
import {OrganizationApp} from '../models/organization.js'
import {validateExtensions} from '../validators/extensions.js'
import {AllAppExtensionRegistrationsQuerySchema} from '../api/graphql/all_app_extension_registrations.js'
import {renderInfo, renderSuccess, renderTasks, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {inTemporaryDirectory, mkdir} from '@shopify/cli-kit/node/fs'
import {joinPath, dirname} from '@shopify/cli-kit/node/path'
import {outputNewline, outputInfo} from '@shopify/cli-kit/node/output'
import {useThemebundling} from '@shopify/cli-kit/node/context/local'
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
}

interface TasksContext {
  bundlePath?: string
  bundle?: boolean
}

export async function deploy(options: DeployOptions) {
  if (!options.app.hasExtensions()) {
    renderInfo({headline: 'No extensions to deploy to Shopify Partners yet.'})
    return
  }

  // eslint-disable-next-line prefer-const
  let {app, identifiers, partnersApp, partnersOrganizationId, token, organization} = await ensureDeployContext(options)
  const apiKey = identifiers.app

  let label: string | undefined

  if (organization.betas.appUiDeployments) {
    label = await renderTextPrompt({
      message: 'Deployment label',
      defaultValue: 'Deployed from CLI',
    })
  }

  outputNewline()
  outputInfo(`Deploying your work to Shopify Partners. It will be part of ${partnersApp.title}`)
  outputNewline()

  const extensions = await Promise.all(
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
    extensions.push(...themeExtensions)
  }

  let registrations: AllAppExtensionRegistrationsQuerySchema
  let validationErrors: UploadExtensionValidationError[] = []
  let deploymentId: number | undefined

  await inTemporaryDirectory(async (tmpDir) => {
    try {
      const bundlePath = joinPath(tmpDir, `bundle.zip`)
      await mkdir(dirname(bundlePath))
      const bundleTheme = useThemebundling() && app.extensions.theme.length !== 0
      const bundleUI = app.extensions.ui.length !== 0
      const bundle = bundleTheme || bundleUI
      await bundleAndBuildExtensions({app, bundlePath, identifiers, bundle})

      const tasks: Task<TasksContext>[] = [
        {
          title: 'Running validation',
          task: async () => {
            await validateExtensions(app)
          },
        },
        {
          title: 'Pushing your code to Shopify',
          task: async () => {
            if (bundle) {
              ;({validationErrors, deploymentId} = await uploadExtensionsBundle({
                apiKey,
                bundlePath,
                extensions,
                token,
                label,
              }))
            }

            if (!useThemebundling()) {
              await uploadThemeExtensions(options.app.extensions.theme, {apiKey, identifiers, token})
            }

            identifiers = await uploadFunctionExtensions(app.extensions.function, {identifiers, token})
            app = await updateAppIdentifiers({app, identifiers, command: 'deploy'})
            registrations = await fetchAppExtensionRegistrations({token, apiKey: identifiers.app})
          },
        },
      ]

      await renderTasks(tasks)

      await outputCompletionMessage({
        app,
        partnersApp,
        partnersOrganizationId,
        identifiers,
        registrations,
        validationErrors,
        deploymentId,
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
  validationErrors,
  deploymentId,
}: {
  app: AppInterface
  partnersApp: Omit<OrganizationApp, 'apiSecretKeys' | 'apiKey'>
  partnersOrganizationId: string
  identifiers: Identifiers
  registrations: AllAppExtensionRegistrationsQuerySchema
  validationErrors: UploadExtensionValidationError[]
  deploymentId?: number
}) {
  if (deploymentId) {
    return renderSuccess({
      headline: 'Deployment created',
      body: {
        link: {
          url: `https://partners.shopify.com/${partnersOrganizationId}/apps/${partnersApp.id}/deployments/${deploymentId}`,
          label: `Deployment ${deploymentId}`,
        },
      },
      nextSteps: ['Publish your deployment to make your changes go live for merchants'],
    })
  }

  let headline: string

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

  const outputDeployedAndLivedMessage = (extension: Extension) => {
    return `${extension.localIdentifier} is live`
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
          items: [
            ...app.extensions.ui.map(outputDeployedButNotLiveMessage),
            ...app.extensions.theme.map(outputDeployedButNotLiveMessage),
            ...app.extensions.function.map(outputDeployedAndLivedMessage),
          ],
        },
      },
    },
  ]

  if (app.extensions.ui.length !== 0 || app.extensions.theme.length !== 0) {
    customSections.push({
      title: 'Next steps',
      body: {
        list: {
          items: await Promise.all([...app.extensions.ui, ...app.extensions.theme].map(outputNextStep)),
        },
      },
    })
  }

  renderSuccess({
    headline,
    customSections,
  })
}
