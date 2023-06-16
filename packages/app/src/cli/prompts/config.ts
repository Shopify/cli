/* eslint-disable no-await-in-loop */
import {renderConfirmationPrompt, renderConfigNamePrompt} from '@shopify/cli-kit/node/ui'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {slugify} from '@shopify/cli-kit/common/string'

export async function selectConfigName(directory: string, defaultName = ''): Promise<string> {
  const defaultValue = slugify(defaultName)
  let configName = await renderConfigNamePrompt({defaultValue})

  while (await fileExists(joinPath(directory, `shopify.app.${configName}.toml`))) {
    const askAgain = await renderConfirmationPrompt({
      message: `Configuration file shopify.app.${configName}.toml already exists. Do you want to choose a different configuration name?`,
      confirmationMessage: "Yes, I'll choose a different name",
      cancellationMessage: 'No, overwrite my existing configuration file',
    })

    if (askAgain) {
      configName = await renderConfigNamePrompt({defaultValue})
    } else {
      break
    }
  }

  return configName
}
