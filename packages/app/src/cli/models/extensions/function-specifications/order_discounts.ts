import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'order_discounts',
  externalIdentifier: 'order_discount',
  externalName: 'Function - Order discount',
  helpURL: 'https://shopify.dev/docs/apps/discounts',
  templatePath: (lang) => `discounts/${lang}/order-discounts/default`,
})

export default spec
