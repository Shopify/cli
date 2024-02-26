import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'

const dependency = '@shopify/post-purchase-ui-extensions'

const checkoutPostPurchaseSpec = createExtensionSpecification({
  identifier: 'checkout_post_purchase',
  dependency,
  partnersWebIdentifier: 'post_purchase',
  schema: BaseSchema,
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild', 'single_js_entry_path'],
  deployConfig: async (config, _) => {
    return {metafields: config.metafields}
  },
})

export default checkoutPostPurchaseSpec
