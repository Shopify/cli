import {ensureReleaseContext} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {AppVersionsDiffQuery, AppVersionsDiffSchema} from '../api/graphql/app_versions_diff.js'
import {AppRelease, AppReleaseSchema} from '../api/graphql/app_release.js'
import {confirmReleasePrompt} from '../prompts/release.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderError, renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

interface ReleaseOptions {
  /** The app to be built and uploaded */
  app: AppInterface

  /** API key of the app in Partners admin */
  apiKey?: string

  /** If true, ignore any cached appId or extensionId */
  reset: boolean

  /** If true, proceed with deploy without asking for confirmation */
  force: boolean

  /** App version identifier */
  version?: string
}

export async function release(options: ReleaseOptions) {
  const {token, apiKey, app} = await ensureReleaseContext(options)

  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await partnersRequest(AppVersionsDiffQuery, token, {
    apiKey,
    versionId: options.version,
  })

  if (Object.keys(versionsDiff).length === 0) {
    throw new AbortError('Version not found')
  }

  const confirmRelease = await confirmReleasePrompt(app.name, versionsDiff)

  interface Context {
    appRelease: AppReleaseSchema
  }

  if (confirmRelease) {
    const tasks = [
      {
        title: 'Releasing version',
        task: async (context: Context) => {
          context.appRelease = await partnersRequest(AppRelease, token, {
            apiKey,
            appVersionId: options.version,
          })
        },
      },
    ]

    const {
      appRelease: {appRelease: release},
    } = await renderTasks<Context>(tasks)

    const deployment = release.deployment

    if (release.userErrors?.length > 0) {
      if (
        // need to check that this is true
        release.userErrors[0]!.message.includes(
          'needs to be submitted for review and approved by Shopify before it can be released',
        )
      ) {
        renderError({
          headline: "Version couldn't be released.",
          body: [
            {link: {url: deployment.location, label: deployment.versionTag}},
            `\n${deployment.message}`,
            '\n\nThis version needs to be submitted for review and approved by Shopify before it can be released.',
          ],
        })
      } else {
        const errors = release.userErrors.map((error) => error.message).join(', ')
        throw new AbortError(errors)
      }
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
}
