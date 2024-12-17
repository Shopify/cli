import {renderConfirmationPrompt} from '@shopify/cli-kit/node/ui'
import {Workflow} from './registry.js'
import {generateExtensionTemplate} from '../extension.js'
import {generateExtensionPrompts} from '../../../prompts/generate/extension.js'
import {buildGenerateOptions, buildPromptOptions} from '../../generate.js'

export const discountDetailsFunctionSettingsCollection: Workflow = {
  afterGenerate: async (options) => {
    const {app, developerPlatformClient, specifications} = options.generateOptions

    const shouldCreateFunction = await renderConfirmationPrompt({
      message: 'Would you like to create a function for this extension?',
      defaultValue: true,
    })

    if (shouldCreateFunction) {
      // create a function extension
      const extensionTemplates = options.extensionTemplates.filter(
        (template) =>
          template.identifier === 'shipping_discounts' ||
          template.identifier === 'product_discounts' ||
          template.identifier === 'order_discounts' ||
          template.identifier == 'discounts_allocator',
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
    }

    return {
      success: true,
    }
  },
}
