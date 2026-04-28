import {createExtensionSpecification} from '../specification.js'
import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {loadLocalesConfig} from '../../../utilities/extensions/locales-configuration.js'
import {ExtensionInstance} from '../extension-instance.js'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/checkout-ui-extensions'

type CheckoutConfigType = zod.infer<typeof CheckoutSchema>
const CheckoutSchema = BaseSchema.extend({
  name: zod.string(),
  extension_points: zod.array(zod.string()).optional(),
  metafields: zod.array(MetafieldSchema).optional(),
  settings: zod
    .object({
      fields: zod.any().optional(),
    })
    .optional(),
})

const checkoutSpec = createExtensionSpecification({
  identifier: 'checkout_ui_extension',
  dependency,
  schema: CheckoutSchema,
  appModuleFeatures: (_) => ['ui_preview', 'cart_url', 'esbuild', 'single_js_entry_path', 'generates_source_maps'],
  getOutputRelativePath: (extension: ExtensionInstance<CheckoutConfigType>) => `dist/${extension.handle}.js`,
  clientSteps: [
    {
      lifecycle: 'build',
      steps: [{id: 'bundle-ui', name: 'Bundle UI Extension', type: 'bundle_ui', config: {}}],
    },
  ],
  deployConfig: async (config, directory) => {
    return {
      extension_points: config.extension_points,
      capabilities: config.capabilities,
      supported_features: config.supported_features,
      metafields: config.metafields ?? [],
      name: config.name,
      settings: config.settings,
      localization: await loadLocalesConfig(directory, 'checkout_ui'),
    }
  },
})

export default checkoutSpec
