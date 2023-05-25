import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/checkout-ui-extensions'

const CheckoutSchema = BaseSchema.extend({
  extensionPoints: zod.array(zod.string()).optional(),
  settings: zod
    .object({
      fields: zod.any().optional(),
    })
    .optional(),
})

const spec = createExtensionSpecification({
  identifier: 'checkout_ui_extension',
  surface: 'checkout',
  dependency,
  partnersWebIdentifier: 'checkout_ui_extension',
  schema: CheckoutSchema,
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'cart_url', 'esbuild'],
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
