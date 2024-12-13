import {Workflow} from './registry.js'
import {patchConfigurationFile} from './patch-configuration-file.js'
import {generateExtensionTemplate} from '../extension.js'
import {generateExtensionPrompts} from '../../../prompts/generate/extension.js'
import {buildGenerateOptions, buildPromptOptions} from '../../generate.js'
import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'

export function functionWithAdminUi(uiTemplateIdentifier: string): Workflow {
  return {
    afterGenerate: async (options) => {
      const {app, developerPlatformClient, specifications} = options.generateOptions
      const functionTomlFilePath = `${options.generatedExtension.directory}/shopify.extension.toml`

      const shouldLinkExtension = await renderConfirmationPrompt({
        message: 'Would you like to create an Admin UI for configuring your function?',
        confirmationMessage: 'Yes (recommended)',
        cancellationMessage: 'No',
        defaultValue: true,
      })

      if (!shouldLinkExtension) {
        return {
          success: true,
        }
      }

      // create a UI extension
      const extensionTemplates = options.extensionTemplates.filter(
        (template) => template.identifier === uiTemplateIdentifier,
      )

      const promptOptions = await buildPromptOptions(extensionTemplates, specifications, app, options.generateOptions)
      // TODO: What if it's larger than the limit?
      promptOptions.name = `${options.generatedExtension.handle}-ui`
      const promptAnswers = await generateExtensionPrompts(promptOptions)
      const generateExtensionOptions = buildGenerateOptions(
        promptAnswers,
        app,
        options.generateOptions,
        developerPlatformClient,
      )
      const generatedExtension = await generateExtensionTemplate(generateExtensionOptions)

      const patch = {
        extensions: [
          {
            ui: {
              handle: generatedExtension.handle,
            },
          },
        ],
      }
      await patchConfigurationFile({
        path: functionTomlFilePath,
        patch,
      })

      return {
        success: true,
        message: {
          headline: [
            'Your extensions were created in',
            {filePath: options.generatedExtension.directory},
            'and',
            {filePath: generatedExtension.directory},
            {char: '.'},
          ],
        },
      }
    },
  }
}
