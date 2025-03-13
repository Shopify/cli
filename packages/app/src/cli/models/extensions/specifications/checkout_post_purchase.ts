import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/post-purchase-ui-extensions'

const checkoutPostPurchaseSpec = createExtensionSpecification({
  identifier: 'checkout_post_purchase',
  dependency,
  partnersWebIdentifier: 'post_purchase',
  schema: BaseSchema.extend({
    metafields: zod.array(MetafieldSchema).optional().default([]),
  }),
  appModuleFeatures: (_) => ['ui_preview', 'bundling', 'esbuild', 'single_js_entry_path'],
  deployConfig: async (config, _) => {
    return {metafields: config.metafields}
  },
})

export default checkoutPostPurchaseSpec
