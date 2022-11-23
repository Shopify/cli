import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema} from '@shopify/cli-kit'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.20.0'}

const CheckoutSchema = BaseExtensionSchema.extend({
  extensionPoints: schema.define.any().optional(),
  settings: schema.define.any().optional(),
})

const spec = createExtensionSpec({
  identifier: 'ui_extension',
  externalIdentifier: 'ui_extension',
  externalName: 'Checkout UI',
  surface: 'checkout',
  dependency,
  partnersWebIdentifier: 'ui_extension',
  schema: CheckoutSchema,
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      capabilities: config.capabilities,
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, 'checkout_ui'),
    }
  },
})

export default spec
