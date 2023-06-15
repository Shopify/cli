import {AbortSilentError} from '@shopify/cli-kit/node/error'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmReleasePrompt(appName: string) {
  const confirm = await renderConfirmationPrompt({
    message: `Release this version of ${appName}?`,
    confirmationMessage: 'Yes, release this version',
    cancellationMessage: 'No, cancel',
  })

  if (!confirm) {
    throw new AbortSilentError()
  }
}
