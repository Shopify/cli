import {createUIExtensionSpec} from '../ui.js'
import {BaseUIExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema} from '@shopify/cli-kit'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.21.2'}

const CheckoutSchema = BaseUIExtensionSchema.extend({
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  settings: schema.define
    .object({
      fields: schema.define.any().optional(),
    })
    .optional(),
})

const spec = createUIExtensionSpec({
  identifier: 'checkout_ui_extension',
  externalIdentifier: 'checkout_ui',
  externalName: 'Checkout UI',
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
