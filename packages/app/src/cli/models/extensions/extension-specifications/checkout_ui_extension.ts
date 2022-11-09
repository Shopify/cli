import {createExtensionSpec} from '../extensions.js'
import {BaseExtensionSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {schema} from '@shopify/cli-kit'

const dependency = {name: '@shopify/checkout-ui-extensions-react', version: '^0.20.0'}

const CheckoutSchema = BaseExtensionSchema.extend({
  extensionPoints: schema.define.array(schema.define.string()).optional(),
  settings: schema.define.string().optional(),
})

const spec = createExtensionSpec({
  identifier: 'checkout_ui_extension',
  externalIdentifier: 'checkout_ui',
  surface: 'checkout',
  dependency,
  partnersWebId: 'checkout_ui_extension',
  schema: CheckoutSchema,
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extensionPoints,
      capabilities: config.capabilities,
      metafields: config.metafields,
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory),
    }
  },
})

export default spec
