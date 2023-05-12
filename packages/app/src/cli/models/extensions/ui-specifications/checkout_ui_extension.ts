import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/checkout-ui-extensions'

const CheckoutSchema = BaseUIExtensionSchema.extend({
  extensionPoints: zod.array(zod.string()).optional(),
  settings: zod
    .object({
      fields: zod.any().optional(),
    })
    .optional(),
})

const spec = createUIExtensionSpecification({
  identifier: 'checkout_ui_extension',
  surface: 'checkout',
  dependency,
  partnersWebIdentifier: 'checkout_ui_extension',
  schema: CheckoutSchema,
  isPreviewable: true,
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      capabilities: config.capabilities,
      metafields: config.metafields,
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, 'checkout_ui'),
    }
  },
  shouldFetchCartUrl: () => true,
})

export default spec
