import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {Workflow} from './registry.js'
import {generateExtensionTemplate} from '../extension.js'
import {generateExtensionPrompts} from '../../../prompts/generate/extension.js'
import {buildGenerateOptions, renderSuccessMessage, buildPromptOptions} from '../../generate.js'
import {GenerateExtensionPromptOutput} from '../../../prompts/generate/extension.js'
import {patchAppConfigurationFile} from './patch-configuration-file.js'

export const productDiscountFunctionCollection: Workflow = {
  afterGenerate: async (options) => {
    const {app, developerPlatformClient, specifications} = options.generateOptions
    const functionTomlFilePath = `${options.generatedExtension.directory}/shopify.extension.toml`

    const shouldLinkExtension = await renderConfirmationPrompt({
      message: 'Would you like to create a UI extension for your function?',
      defaultValue: true,
    })

    if (shouldLinkExtension) {
      // create a UI extension
      const extensionTemplates = options.extensionTemplates.filter(
        (template) => template.identifier === 'discount_details_function_settings',
      )

      const promptOptions = await buildPromptOptions(extensionTemplates, specifications, app, options.generateOptions)
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

      await patchAppConfigurationFile({
        path: functionTomlFilePath,
        patch,
      })
      renderSuccessMessage(generatedExtension, app.packageManager)
    }
  },
}
