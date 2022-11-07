import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'product_discounts',
  externalType: 'product_discount',
  externalName: 'Function - Product discount',
  helpURL: 'https://shopify.dev/apps/subscriptions/discounts',
  templatePath: (lang) => `discounts/${lang}/product-discounts/default`,
})

export default spec
