import {AppVersionsDiffSchema} from '../api/graphql/app_versions_diff.js'
import metadata from '../metadata.js'
import {AppInterface} from '../models/app/app.js'
import {isAppConfigSpecification} from '../models/extensions/app-config.js'
import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt, renderDangerousConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmReleasePrompt(
  appName: string,
  versionsDiff: AppVersionsDiffSchema['app']['versionsDiff'],
  app: AppInterface,
) {
  const infoTable = []
  // Filter out app config extensions in the prompt
  const extensions = [...versionsDiff.added, ...versionsDiff.updated].filter(
    (extension) => !isAppConfigSpecification(app, extension.specification.identifier),
  )

  if (extensions.length > 0) {
    infoTable.push({
      header: 'Includes:',
      items: extensions.map((extension) => extension.registrationTitle),
      bullet: '+',
    })
  }

  // Filter out app config extensions in the prompt
  const removed = versionsDiff.removed.filter(
    (extension) => !isAppConfigSpecification(app, extension.specification.identifier),
  )

  if (removed.length > 0) {
    infoTable.push({
      header: 'Removes:',
      helperText: 'This can permanently delete app user data.',
      items: removed.map((extension) => extension.registrationTitle),
      bullet: '-',
    })
  }
  let confirm: boolean
  const message = `Release this version of ${appName}?`
  if (removed.length > 0) {
    confirm = await renderDangerousConfirmationPrompt({message, infoTable, confirmation: appName})
  } else {
    confirm = await renderConfirmationPrompt({
      message,
      infoTable,
      confirmationMessage: 'Yes, release this version',
      cancellationMessage: 'No, cancel',
    })
  }

  await metadata.addPublicMetadata(() => ({
    cmd_release_confirm_cancelled: !confirm,
  }))

  if (!confirm) {
    throw new AbortSilentError()
  }
}
