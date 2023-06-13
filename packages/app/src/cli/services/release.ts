import {ensureReleaseContext} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {AppRelease, AppReleaseSchema} from '../api/graphql/app_release.js'
import {confirmReleasePrompt} from '../prompts/release.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {renderError, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

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
  version?: string

  /** App version identifier */
  versionId?: string
}

export async function release(options: ReleaseOptions) {
  const {token, apiKey, app} = await ensureReleaseContext(options)

  await confirmReleasePrompt(app.name)
  interface Context {
    appRelease: AppReleaseSchema
  }

  const tasks = [
    {
      title: 'Releasing version',
      task: async (context: Context) => {
        context.appRelease = await partnersRequest(AppRelease, token, {
          apiKey,
          deploymentId: options.versionId,
          versionTag: options.version,
        })
      },
    },
  ]

  const {
    appRelease: {appRelease: release},
  } = await renderTasks<Context>(tasks)

  const deployment = release.deployment

  if (release.userErrors?.length > 0) {
    const errorsMessage = release.userErrors.map((error) => error.message).join(', ')
    if (!deployment) throw new AbortError(errorsMessage)
    renderError({
      headline: "Version couldn't be released.",
      body: [
        {link: {url: deployment.location, label: deployment.versionTag}},
        `\n${deployment.message}`,
        `\n\n${errorsMessage}`,
      ],
    })
  } else {
    renderSuccess({
      headline: 'Version released to users.',
      body: [{link: {url: deployment.location, label: deployment.versionTag}}, `\n${deployment.message}`],
      nextSteps: [
        [
          'Run',
          {command: formatPackageManagerCommand(app.packageManager, 'shopify app versions list')},
          'to see rollout progress.',
        ],
      ],
    })
  }
}
