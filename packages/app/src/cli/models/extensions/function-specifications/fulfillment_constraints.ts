import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'fulfillment_constraints',
  externalIdentifier: 'fulfillment_constraints',
  externalName: 'Fulfillment constraints',
  supportedFlavors: [{name: 'Rust', value: 'rust'}],
  templatePath: (lang) => `order-routing/${lang}/fulfillment-constraints/default`,
})

export default spec
