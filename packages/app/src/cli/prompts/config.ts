import {renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'

export async function selectConfigName(directory: string): Promise<string> {
  let configName = await renderTextPrompt({
    message: 'Configuration file name:',
  })

  let overwriteFile = false
  let fileAlreadyExists = await fileExists(joinPath(directory, `shopify.app.${configName}.toml`))

  const renderMessage = async () => {
    const answer = await renderConfirmationPrompt({
      message: `Configuration file shopify.app.${configName}.toml already exists. Do you want to choose a different configuration name?`,
      confirmationMessage: "Yes, I'll choose a different name",
      cancellationMessage: 'No, overwrite my existing configuration file',
    })

    // eslint-disable-next-line no-negated-condition
    if (!answer) {
      overwriteFile = true
    } else {
      // eslint-disable-next-line require-atomic-updates
      configName = await renderTextPrompt({
        message: 'Configuration file name:',
      })

      fileAlreadyExists = await fileExists(joinPath(directory, `shopify.app.${configName}.toml`))

      if (fileAlreadyExists) await renderMessage()
    }
  }

  if (fileAlreadyExists && !overwriteFile) {
    await renderMessage()
  }

  return configName
}
