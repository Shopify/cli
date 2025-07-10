import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmExportPrompt(fromStore: string, toFile: string): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Export data from ${fromStore} to ${toFile}?`,
    confirmationMessage: 'Yes, export',
    cancellationMessage: 'Cancel',
  })
}
