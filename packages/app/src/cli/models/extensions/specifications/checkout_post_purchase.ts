import {BaseSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'

const dependency = '@shopify/post-purchase-ui-extensions'

const spec = createExtensionSpecification({
  identifier: 'checkout_post_purchase',
  dependency,
  partnersWebIdentifier: 'post_purchase',
  helpURL: 'https://shopify.dev/docs/apps/checkout/post-purchase',
  schema: BaseSchema,
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild'],
  deployConfig: async (config, _) => {
    return {metafields: config.metafields}
  },
})

export default spec
