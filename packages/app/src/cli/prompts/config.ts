/* eslint-disable no-await-in-loop */
import {RenderTextPromptOptions, renderConfirmationPrompt, renderTextPrompt} from '@shopify/cli-kit/node/ui'
import {fileExists} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {slugify} from '@shopify/cli-kit/common/string'

export async function selectConfigName(directory: string, defaultName = ''): Promise<string> {
  const namePromptOptions = buildTextPromptOptions(defaultName)
  let configName = slugify(await renderTextPrompt(namePromptOptions))

  while (await fileExists(joinPath(directory, `shopify.app.${configName}.toml`))) {
    const askAgain = await renderConfirmationPrompt({
      message: `Configuration file shopify.app.${configName}.toml already exists. Do you want to choose a different configuration name?`,
      confirmationMessage: "Yes, I'll choose a different name",
      cancellationMessage: 'No, overwrite my existing configuration file',
    })

    if (askAgain) {
      configName = slugify(await renderTextPrompt(namePromptOptions))
    } else {
      break
    }
  }

  return configName
}

function buildTextPromptOptions(defaultValue: string): RenderTextPromptOptions {
  return {
    message: 'Configuration file name:',
    defaultValue,
    validate,
    previewPrefix: () => 'shopify.app.',
    previewValue: (value: string) => slugify(value),
    previewSuffix: () => '.toml will be generated in your root directory\n',
  }
}

export function validate(value: string): string | undefined {
  const result = slugify(value)
  if (result.length === 0) return `The file name can't be empty.`
  // Max filename size for Windows/Mac including the prefix/postfix
  if (result.length > 238) return 'The file name is too long.'
}
