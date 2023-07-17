import {AppVersionsDiffSchema} from '../api/graphql/app_versions_diff.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmReleasePrompt(
  appName: string,
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff'],
) {
  const infoTable = []
  const extensions = [...versionsDiff.added, ...versionsDiff.updated]

  if (extensions.length > 0) {
    infoTable.push({
      header: 'Includes:',
      items: extensions.map((extension) => extension.registrationTitle),
      bullet: '+',
    })
  }

  if (versionsDiff.removed.length > 0) {
    infoTable.push({
      header: 'Removes:',
      helperText: 'This can permanently delete app user data.',
      items: versionsDiff.removed.map((extension) => extension.registrationTitle),
      bullet: '-',
    })
  }
  const confirm = await renderConfirmationPrompt({
    message: `Release this version of ${appName}?`,
    infoTable,
    confirmationMessage: 'Yes, release this version',
    cancellationMessage: 'No, cancel',
  })

  if (!confirm) {
    throw new AbortSilentError()
  }
}
