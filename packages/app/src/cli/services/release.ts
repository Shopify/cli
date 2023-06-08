import {ensureReleaseContext} from './context.js'
import {AppInterface} from '../models/app/app.js'
import {AppVersionsDiffQuery, AppVersionsDiffSchema} from '../api/graphql/app_versions_diff.js'
import {AppRelease, AppReleaseSchema} from '../api/graphql/app_release.js'
import {partnersRequest} from '@shopify/cli-kit/node/api/partners'
import {AbortError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt, renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
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
  // eslint-disable-next-line prefer-const
  let {token, apiKey, app} = await ensureReleaseContext(options)

  const {
    app: {versionsDiff},
  }: AppVersionsDiffSchema = await partnersRequest(AppVersionsDiffQuery, token, {
    apiKey,
    versionId: options.version,
  })

  if (Object.keys(versionsDiff).length === 0) {
    throw new AbortError('Version not found')
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(versionsDiff))

  const infoTable = []
  const extensions = [...versionsDiff.added, ...versionsDiff.updated]

  if (extensions.length > 0) {
    infoTable.push({
      header: 'Extensions',
      items: extensions.map((extension) => extension.registrationTitle),
    })
  }

  if (versionsDiff.removed.length > 0) {
    infoTable.push({
      header: 'Removed',
      color: 'red',
      helperText: 'Will be removed for users when this version is released.',
      items: versionsDiff.removed.map((extension) => extension.registrationTitle),
    })
  }

  const confirmRelease = await renderConfirmationPrompt({
    message: `Release this version of ${app.name}?`,
    infoTable,
    confirmationMessage: 'Yes, release this version',
    cancellationMessage: 'No, cancel',
  })

  if (confirmRelease) {
    const appRelease: AppReleaseSchema = await partnersRequest(AppRelease, token, {
      apiKey,
      appVersionId: options.version,
    })
    const release = appRelease.appRelease
    const deployment = release.deployment

    if (release.userErrors.length > 0) {
      if (
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
