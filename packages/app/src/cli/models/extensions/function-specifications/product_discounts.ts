import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'product_discounts',
  externalIdentifier: 'product_discount',
  externalName: 'Function - Product discount',
  helpURL: 'https://shopify.dev/docs/apps/discounts',
  templatePath: (lang) => `discounts/${lang}/product-discounts/default`,
})

export default spec
