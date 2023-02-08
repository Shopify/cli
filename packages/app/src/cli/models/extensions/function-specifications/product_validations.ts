import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'product_validation',
  externalIdentifier: 'product_validation',
  externalName: 'Function - Product Validation',
  helpURL: 'https://shopify.dev/apps/todo',
  templatePath: (lang) => `validations/${lang}/product-validation/default`,
})

export default spec
