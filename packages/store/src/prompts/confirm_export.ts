import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmExportPrompt(fromStore: string, toFile: string, fileExists: boolean): Promise<boolean> {
  const message = fileExists
    ? [
        `Export data from ${fromStore} to ${toFile}`,
        {warn: `\n"${toFile}" already exists do you want to overwrite it?`},
      ]
    : `Export data from ${fromStore} to ${toFile}?`

  const confirmationMessage = fileExists ? 'Yes, export and overwrite' : 'Yes, export'

  return renderConfirmationPrompt({
    message,
    confirmationMessage,
    cancellationMessage: 'Cancel',
  })
}
