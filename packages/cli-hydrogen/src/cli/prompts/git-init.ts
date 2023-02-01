import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export const gitInit = async (): Promise<boolean> => {
  return renderConfirmationPrompt({
    message: "Git version control hasn't been initialized for this directory. Do you want to do that now?",
    confirmationMessage: 'Yes',
    cancellationMessage: 'No',
  })
}
