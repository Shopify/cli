import {createUIExtensionSpecification} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema} from '@shopify/cli-kit/node/schema'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.24.0'}

const CheckoutSchema = BaseUIExtensionSchema.extend({
  extensionPoints: schema.array(schema.string()).optional(),
  settings: schema
    .object({
      fields: schema.any().optional(),
    })
    .optional(),
})

const spec = createUIExtensionSpecification({
  identifier: 'checkout_ui_extension',
  surface: 'checkout',
  dependency,
  partnersWebIdentifier: 'checkout_ui_extension',
  schema: CheckoutSchema,
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
