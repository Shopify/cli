import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'delivery_customization',
  externalIdentifier: 'delivery_customization',
  externalName: 'Delivery customization',
  gated: true,
  templatePath: (lang) => `checkout/${lang}/delivery-customization/default`,
})

export default spec
