import {createFunctionSpecification} from '../functions.js'

const spec = createFunctionSpecification({
  identifier: 'delivery_customization',
  externalIdentifier: 'delivery_customization',
  externalName: 'Function - Delivery customization',
  supportedFlavors: [{name: 'Javascript', value: 'vanilla-js'}],
  gated: false,
  templatePath: (lang) => `checkout/${lang}/delivery-customization/default`,
})

export default spec
