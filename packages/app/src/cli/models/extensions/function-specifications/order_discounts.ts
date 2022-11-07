import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'order_discounts',
  externalType: 'order_discount',
  externalName: 'Function - Order discount',
  helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
  templatePath: (lang) => `discounts/${lang}/order-discounts/default`,
})

export default spec
