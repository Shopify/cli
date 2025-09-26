import {BaseSchema, MetafieldSchema} from '../schemas.js'
import {createExtensionSpecification} from '../specification.js'
import {zod} from '@shopify/cli-kit/node/schema'

const dependency = '@shopify/post-purchase-ui-extensions'

const CheckoutPostPurchaseSchema = BaseSchema.extend({
  metafields: zod.array(MetafieldSchema).optional(),
})

const checkoutPostPurchaseSpec = createExtensionSpecification({
  identifier: 'checkout_post_purchase',
  dependency,
  partnersWebIdentifier: 'post_purchase',
  schema: CheckoutPostPurchaseSchema,
  appModuleFeatures: (_) => ['ui_preview', 'cart_url', 'esbuild', 'single_js_entry_path'],
  buildSteps: [{mode: 'ui'}],
  deployConfig: async (config, _) => {
    return {metafields: config.metafields ?? []}
  },
})

export default checkoutPostPurchaseSpec
