import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmImportPrompt(fromFile: string, targetDomain: string): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Import data from ${fromFile} to ${targetDomain}?`,
    confirmationMessage: 'Yes, import',
    cancellationMessage: 'Cancel',
  })
}
