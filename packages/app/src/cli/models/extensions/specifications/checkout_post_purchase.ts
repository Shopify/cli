import {ExtensionInstance} from '../extension-instance.js'
import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/post-purchase-ui-extensions'

type CheckoutPostPurchaseConfigType = zod.infer<typeof CheckoutPostPurchaseSchema>
const CheckoutPostPurchaseSchema = BaseSchema.extend({
  metafields: zod.array(MetafieldSchema).optional(),
})

const checkoutPostPurchaseSpec = createExtensionSpecification({
  identifier: 'checkout_post_purchase',
  dependency,
  partnersWebIdentifier: 'post_purchase',
  schema: CheckoutPostPurchaseSchema,
  appModuleFeatures: (_) => ['ui_preview', 'cart_url', 'esbuild', 'single_js_entry_path'],
  buildConfig: {mode: 'ui'},
  getOutputFileName: (extension: ExtensionInstance<CheckoutPostPurchaseConfigType>) => `${extension.handle}.js`,
  getOutputRelativePath: (_extension: ExtensionInstance<CheckoutPostPurchaseConfigType>) => 'dist',
  clientSteps: [
    {
      lifecycle: 'deploy',
      steps: [
        {id: 'bundle-ui', name: 'Bundle UI Extension', type: 'bundle_ui', config: {}},
        {id: 'copy-static-assets', name: 'Copy Static Assets', type: 'copy_static_assets', config: {}},
      ],
    },
  ],
  deployConfig: async (config, _) => {
    return {metafields: config.metafields ?? []}
  },
})

export default checkoutPostPurchaseSpec
