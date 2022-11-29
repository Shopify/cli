import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'delivery_customization',
  externalIdentifier: 'delivery_customization',
  externalName: 'Delivery customization',
  public: false,
  templatePath: (lang) => `checkout/${lang}/delivery-customization/defaultt`,
})

export default spec
