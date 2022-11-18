import {createFunctionSpec} from '../functions.js'

const spec = createFunctionSpec({
  identifier: 'payment_customization',
  externalIdentifier: 'payment_customization',
  externalName: 'Payment customization',
  public: false,
  templatePath: (lang) => `checkout/${lang}/payment-customization/default`,
})

export default spec
