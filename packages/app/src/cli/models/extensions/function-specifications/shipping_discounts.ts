import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'shipping_discounts',
  externalType: 'shipping_discount',
  externalName: 'Function - Shipping discount',
  helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
  templatePath: (lang) => `discounts/${lang}/shipping-discounts/default`,
})

export default spec
