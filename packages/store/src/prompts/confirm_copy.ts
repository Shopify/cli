import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export async function confirmCopyPrompt(fromStore: string, toStore: string): Promise<boolean> {
  return renderConfirmationPrompt({
    message: `Confirm to proceed with copying data from ${fromStore} to ${toStore}. This action can't be undone.`,
    defaultValue: true,
  })
}
